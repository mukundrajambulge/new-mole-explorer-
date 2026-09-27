#include "mole/docking/scoring.hpp"

#include <algorithm>
#include <array>
#include <cfenv>
#include <cmath>
#include <limits>
#include <string>
#include <utility>

#if defined(__SSE__)
#include <xmmintrin.h>
#endif

namespace mole::docking {
namespace {

static_assert(std::numeric_limits<double>::is_iec559 &&
              std::numeric_limits<double>::radix == 2 &&
              std::numeric_limits<double>::digits == 53,
              "ME_DOCKING_V1_CPU_REFERENCE_NUMERIC_1_0 requires IEEE-754 binary64");

constexpr std::array<double, kTermCount> kCoefficients{
    -0.035579, -0.005156, 0.840245, -0.035069, -0.587439};

class NeumaierSum final {
 public:
  void add(double value) noexcept {
    const double next = sum_ + value;
    if (std::abs(sum_) >= std::abs(value)) {
      correction_ += (sum_ - next) + value;
    } else {
      correction_ += (value - next) + sum_;
    }
    sum_ = next;
  }

  [[nodiscard]] double value() const noexcept { return sum_ + correction_; }

 private:
  double sum_{};
  double correction_{};
};

[[nodiscard]] bool finite(const Vec3& point) noexcept {
  return std::isfinite(point.x) && std::isfinite(point.y) && std::isfinite(point.z);
}

[[nodiscard]] bool runtime_rounding_supported() noexcept {
  if (std::fegetround() != FE_TONEAREST) return false;
#if defined(__SSE__)
  constexpr unsigned kFlushToZero = 1U << 15U;
  constexpr unsigned kDenormalsAreZero = 1U << 6U;
  const unsigned control = _mm_getcsr();
  if ((control & (kFlushToZero | kDenormalsAreZero)) != 0U) return false;
#endif
  return true;
}

[[nodiscard]] bool valid_digest_ref(const std::string& value) noexcept {
  return value.compare(0, 7, "sha256:") == 0 && value.size() == 71 &&
         value.find_first_not_of("0123456789abcdef", 7) == std::string::npos;
}

[[nodiscard]] Result invalid_result(const Request& request, std::string code, std::string message) {
  Result result;
  result.diagnostic_code = std::move(code);
  result.diagnostic = std::move(message);
  result.receptor_state_digest = request.receptor_state_digest;
  result.ligand_state_digest = request.ligand_state_digest;
  result.coordinate_state_digest = request.coordinate_state_digest;
  result.search_region_digest = request.search_region_digest;
  result.scoring_profile_digest = request.scoring_profile_digest;
  result.typing_profile_digest = request.typing_profile_digest;
  result.chemistry_profile_digest = request.chemistry_profile_digest;
  result.numerical_backend_profile_digest = request.numerical_backend_profile_digest;
  result.receptor_typing_assignment_digest = request.receptor_typing_assignment_digest;
  result.ligand_typing_assignment_digest = request.ligand_typing_assignment_digest;
  return result;
}

[[nodiscard]] bool atom_less(const Atom* left, const Atom* right) noexcept {
  return left->atom_uid < right->atom_uid;
}

[[nodiscard]] std::vector<const Atom*> stable_atoms(const std::vector<Atom>& atoms) {
  std::vector<const Atom*> ordered;
  ordered.reserve(atoms.size());
  for (const Atom& atom : atoms) ordered.push_back(&atom);
  std::sort(ordered.begin(), ordered.end(), atom_less);
  return ordered;
}

[[nodiscard]] std::vector<const Atom*> scoring_centers(const std::vector<const Atom*>& atoms) {
  std::vector<const Atom*> centers;
  centers.reserve(atoms.size());
  for (const Atom* atom : atoms) {
    if (atom->scoring_center) centers.push_back(atom);
  }
  return centers;
}

[[nodiscard]] bool unique_nonempty_uids(const std::vector<const Atom*>& atoms) noexcept {
  for (std::size_t index = 0; index < atoms.size(); ++index) {
    if (atoms[index]->atom_uid.empty()) return false;
    if (index > 0 && atoms[index - 1]->atom_uid == atoms[index]->atom_uid) return false;
  }
  return true;
}

[[nodiscard]] std::array<double, kTermCount> pair_terms(const Atom& receptor,
                                                        const Atom& ligand,
                                                        double distance) noexcept {
  std::array<double, kTermCount> terms{};
  if (!(distance < kPhysicalCutoffAngstrom)) return terms;

  const double radius = *xs_radius(receptor.xs_type) + *xs_radius(ligand.xs_type);
  const double surface_distance = distance - radius;
  const double scaled_gaussian1 = surface_distance / 0.5;
  const double scaled_gaussian2 = (surface_distance - 3.0) / 2.0;

  terms[static_cast<std::size_t>(Term::Gaussian1)] =
      std::exp(-(scaled_gaussian1 * scaled_gaussian1));
  terms[static_cast<std::size_t>(Term::Gaussian2)] =
      std::exp(-(scaled_gaussian2 * scaled_gaussian2));
  terms[static_cast<std::size_t>(Term::Repulsion)] =
      surface_distance <= 0.0 ? surface_distance * surface_distance : 0.0;

  if (xs_hydrophobic(receptor.xs_type) && xs_hydrophobic(ligand.xs_type)) {
    if (surface_distance <= 0.5) {
      terms[static_cast<std::size_t>(Term::Hydrophobic)] = 1.0;
    } else if (surface_distance < 1.5) {
      terms[static_cast<std::size_t>(Term::Hydrophobic)] = 1.5 - surface_distance;
    }
  }

  const bool donor_acceptor =
      (xs_donor(receptor.xs_type) && xs_acceptor(ligand.xs_type)) ||
      (xs_acceptor(receptor.xs_type) && xs_donor(ligand.xs_type));
  if (donor_acceptor) {
    if (surface_distance <= -0.7) {
      terms[static_cast<std::size_t>(Term::HydrogenBond)] = 1.0;
    } else if (surface_distance < 0.0) {
      terms[static_cast<std::size_t>(Term::HydrogenBond)] = -surface_distance / 0.7;
    }
  }
  return terms;
}

}  // namespace

std::optional<double> xs_radius(std::string_view type) noexcept {
  if (type == "C_H" || type == "C_P") return 1.9;
  if (type == "N_P" || type == "N_D" || type == "N_A" || type == "N_DA") return 1.8;
  if (type == "O_P" || type == "O_D" || type == "O_A" || type == "O_DA") return 1.7;
  if (type == "S_P") return 2.0;
  if (type == "P_P") return 2.1;
  if (type == "F_H") return 1.5;
  if (type == "Cl_H") return 1.8;
  if (type == "Br_H") return 2.0;
  if (type == "I_H") return 2.2;
  return std::nullopt;
}

bool xs_element_matches(std::string_view type, std::string_view element) noexcept {
  if (type == "C_H" || type == "C_P") return element == "C";
  if (type == "N_P" || type == "N_D" || type == "N_A" || type == "N_DA") return element == "N";
  if (type == "O_P" || type == "O_D" || type == "O_A" || type == "O_DA") return element == "O";
  if (type == "S_P") return element == "S";
  if (type == "P_P") return element == "P";
  if (type == "F_H") return element == "F";
  if (type == "Cl_H") return element == "Cl";
  if (type == "Br_H") return element == "Br";
  if (type == "I_H") return element == "I";
  return false;
}

TypingAssignment assign_xs_type(const TypingFeatures& features) noexcept {
  constexpr std::string_view kUnsupported = "SCORING_ATOM_TYPE_UNSUPPORTED";
  constexpr std::string_view kAmbiguous = "SCORING_ATOM_TYPE_AMBIGUOUS";
  const auto no_positive_role = [&features]() noexcept {
    return (!features.donor.has_value() || !*features.donor) &&
           (!features.acceptor.has_value() || !*features.acceptor);
  };
  if (features.element == "C") {
    if (!features.carbon_bonded_to_heteroatom.has_value() || !no_positive_role()) {
      return {TypingStatus::Ambiguous, {}, kAmbiguous};
    }
    return {TypingStatus::Supported,
            *features.carbon_bonded_to_heteroatom ? "C_P" : "C_H", {}};
  }
  if (features.carbon_bonded_to_heteroatom.has_value()) {
    return {TypingStatus::Ambiguous, {}, kAmbiguous};
  }
  if (features.element == "N" || features.element == "O") {
    if (!features.donor.has_value() || !features.acceptor.has_value()) {
      return {TypingStatus::Ambiguous, {}, kAmbiguous};
    }
    if (features.element == "N") {
      if (*features.donor && *features.acceptor) return {TypingStatus::Supported, "N_DA", {}};
      if (*features.donor) return {TypingStatus::Supported, "N_D", {}};
      if (*features.acceptor) return {TypingStatus::Supported, "N_A", {}};
      return {TypingStatus::Supported, "N_P", {}};
    }
    if (*features.donor && *features.acceptor) return {TypingStatus::Supported, "O_DA", {}};
    if (*features.donor) return {TypingStatus::Supported, "O_D", {}};
    if (*features.acceptor) return {TypingStatus::Supported, "O_A", {}};
    return {TypingStatus::Supported, "O_P", {}};
  }
  if (features.donor.value_or(false) || features.acceptor.value_or(false)) {
    return {TypingStatus::Unsupported, {}, kUnsupported};
  }
  if (features.element == "S") return {TypingStatus::Supported, "S_P", {}};
  if (features.element == "P") return {TypingStatus::Supported, "P_P", {}};
  if (features.element == "F") return {TypingStatus::Supported, "F_H", {}};
  if (features.element == "Cl") return {TypingStatus::Supported, "Cl_H", {}};
  if (features.element == "Br") return {TypingStatus::Supported, "Br_H", {}};
  if (features.element == "I") return {TypingStatus::Supported, "I_H", {}};
  return {TypingStatus::Unsupported, {}, kUnsupported};
}

bool xs_hydrophobic(std::string_view type) noexcept {
  return type == "C_H" || type == "F_H" || type == "Cl_H" || type == "Br_H" || type == "I_H";
}

bool xs_donor(std::string_view type) noexcept {
  return type == "N_D" || type == "N_DA" || type == "O_D" || type == "O_DA";
}

bool xs_acceptor(std::string_view type) noexcept {
  return type == "N_A" || type == "N_DA" || type == "O_A" || type == "O_DA";
}

Result score_direct(const Request& request) {
  if (request.receptor_profile_id != kReceptorProfileId) {
    return invalid_result(request, "UNSUPPORTED_RECEPTOR_PROFILE",
                          "The direct scorer requires the frozen dry-core receptor profile.");
  }
  if (request.scoring_profile_id != kScoringProfileId) {
    return invalid_result(request, "SCORING_PROFILE_MISMATCH",
                          "The request does not use the frozen Vina-classical scoring profile.");
  }
  if (request.receptor_typing_profile_id != kTypingProfileId ||
      request.ligand_typing_profile_id != kTypingProfileId) {
    return invalid_result(request, "SCORING_TYPING_PROFILE_MISMATCH",
                          "Both prepared atom sets must use the frozen XS typing profile.");
  }
  if (request.chemistry_profile_id != kChemistryProfileId) {
    return invalid_result(request, "SCORING_CHEMISTRY_PROFILE_MISMATCH",
                          "The request does not use the frozen supported-chemistry profile.");
  }
  if (request.numerical_backend_profile_id != kBackendProfileId) {
    return invalid_result(request, "NUMERICAL_BACKEND_UNSUPPORTED",
                          "The direct oracle requires the pinned CPU reference numerical profile.");
  }
  if (request.site_class != SiteClass::DryCore) {
    if (request.site_class == SiteClass::FixedWater || request.site_class == SiteClass::MobileWater ||
        request.site_class == SiteClass::WaterDependent) {
      return invalid_result(request, "SCORING_UNSUPPORTED_EXPLICIT_WATER",
                            "The canonical dry-core profile does not score explicit or essential water.");
    }
    if (request.site_class == SiteClass::Ion || request.site_class == SiteClass::Metal) {
      return invalid_result(request, "SCORING_UNSUPPORTED_METAL_SITE",
                            "Site-influencing metal or unsupported ion chemistry is outside ordinary V1.");
    }
    if (request.site_class == SiteClass::Cofactor) {
      return invalid_result(request, "SCORING_UNSUPPORTED_COFACTOR",
                            "An essential site-influencing cofactor is outside ordinary V1.");
    }
    return invalid_result(request, "SCORING_SITE_CLASS_UNSUPPORTED",
                          "The receptor site class is not supported by the canonical dry-core profile.");
  }
  if (request.coordinate_units != "ANGSTROM") {
    return invalid_result(request, "INVALID_COORDINATE_UNITS", "Coordinates must be expressed in Angstrom.");
  }
  if (!valid_digest_ref(request.receptor_state_digest) ||
      !valid_digest_ref(request.ligand_state_digest) ||
      !valid_digest_ref(request.coordinate_state_digest) ||
      !valid_digest_ref(request.search_region_digest) ||
      !valid_digest_ref(request.scoring_profile_digest) ||
      !valid_digest_ref(request.typing_profile_digest) ||
      !valid_digest_ref(request.chemistry_profile_digest) ||
      !valid_digest_ref(request.numerical_backend_profile_digest) ||
      !valid_digest_ref(request.receptor_typing_assignment_digest) ||
      !valid_digest_ref(request.ligand_typing_assignment_digest)) {
    return invalid_result(request, "INVALID_PROVENANCE_DIGEST", "All D2 input references must be SHA-256 digests.");
  }
  if (!runtime_rounding_supported()) {
    return invalid_result(request, "UNSUPPORTED_FLOATING_POINT_ENVIRONMENT",
                          "The scorer requires round-to-nearest and disabled FTZ/DAZ.");
  }
  if (request.receptor_atoms.empty() || request.ligand_atoms.empty()) {
    return invalid_result(request, "EMPTY_ATOM_SET", "Receptor and ligand atom sets must both be nonempty.");
  }

  const auto receptor_all = stable_atoms(request.receptor_atoms);
  const auto ligand_all = stable_atoms(request.ligand_atoms);
  if (!unique_nonempty_uids(receptor_all) || !unique_nonempty_uids(ligand_all)) {
    return invalid_result(request, "INVALID_ATOM_UID_ORDER", "AtomUID values must be unique and nonempty per molecule.");
  }

  const auto receptor = scoring_centers(receptor_all);
  const auto ligand = scoring_centers(ligand_all);
  if (receptor.empty() || ligand.empty()) {
    return invalid_result(request, "EMPTY_ATOM_SET", "Receptor and ligand must each contain a scored heavy-atom center.");
  }

  int ligand_formal_charge = 0;
  for (const Atom* atom : ligand_all) {
    if (!atom->formal_charge.has_value()) {
      return invalid_result(request, "AMBIGUOUS_LIGAND_FORMAL_CHARGE",
                            "Every ligand formal charge must be explicit in the prepared chemical state.");
    }
    if ((*atom->formal_charge > 0 && ligand_formal_charge > std::numeric_limits<int>::max() - *atom->formal_charge) ||
        (*atom->formal_charge < 0 && ligand_formal_charge < std::numeric_limits<int>::min() - *atom->formal_charge)) {
      return invalid_result(request, "INVALID_LIGAND_FORMAL_CHARGE", "Ligand formal charge sum overflows its supported representation.");
    }
    ligand_formal_charge += *atom->formal_charge;
  }
  if (ligand_formal_charge < -1 || ligand_formal_charge > 1) {
    return invalid_result(request, "SCORING_CHEMISTRY_OUTSIDE_VALIDATED_DOMAIN",
                          "The supported ligand net formal charge is limited to -1, 0, or +1.");
  }

  for (const Atom* atom : receptor_all) {
    if (!finite(atom->position)) {
      return invalid_result(request, "SCORING_NONFINITE_RESULT", "A receptor coordinate is not finite.");
    }
    if (!atom->scoring_center && (atom->element != "H" || !atom->xs_type.empty())) {
      return invalid_result(request, "SCORING_ATOM_TYPE_UNSUPPORTED",
                            "Only explicit hydrogen helpers may be excluded from scored atom centers.");
    }
    if (atom->scoring_center &&
        (!xs_radius(atom->xs_type) || !xs_element_matches(atom->xs_type, atom->element))) {
      return invalid_result(request, "SCORING_ATOM_TYPE_UNSUPPORTED",
                            "A receptor atom has no supported element-compatible XS type.");
    }
  }
  for (const Atom* atom : ligand_all) {
    if (!finite(atom->position)) {
      return invalid_result(request, "SCORING_NONFINITE_RESULT", "A ligand coordinate is not finite.");
    }
    if (!atom->scoring_center && (atom->element != "H" || !atom->xs_type.empty())) {
      return invalid_result(request, "SCORING_ATOM_TYPE_UNSUPPORTED",
                            "Only explicit hydrogen helpers may be excluded from scored atom centers.");
    }
    if (atom->scoring_center &&
        (!xs_radius(atom->xs_type) || !xs_element_matches(atom->xs_type, atom->element))) {
      return invalid_result(request, "SCORING_ATOM_TYPE_UNSUPPORTED",
                            "A ligand atom has no supported element-compatible XS type.");
    }
  }

  std::array<NeumaierSum, kTermCount> raw_sums{};
  bool gradient_valid = true;
  for (const Atom* ligand_atom : ligand) {
    for (const Atom* receptor_atom : receptor) {
      const double dx = receptor_atom->position.x - ligand_atom->position.x;
      const double dy = receptor_atom->position.y - ligand_atom->position.y;
      const double dz = receptor_atom->position.z - ligand_atom->position.z;
      const double distance = std::hypot(std::hypot(dx, dy), dz);
      if (!std::isfinite(distance)) {
        return invalid_result(request, "SCORING_NONFINITE_RESULT", "An atom-pair distance is not finite.");
      }
      if (distance == 0.0) gradient_valid = false;
      const auto terms = pair_terms(*receptor_atom, *ligand_atom, distance);
      for (std::size_t term = 0; term < kTermCount; ++term) raw_sums[term].add(terms[term]);
    }
  }

  Result result;
  result.valid = true;
  result.gradient_valid = gradient_valid;
  result.receptor_state_digest = request.receptor_state_digest;
  result.ligand_state_digest = request.ligand_state_digest;
  result.coordinate_state_digest = request.coordinate_state_digest;
  result.search_region_digest = request.search_region_digest;
  result.scoring_profile_digest = request.scoring_profile_digest;
  result.typing_profile_digest = request.typing_profile_digest;
  result.chemistry_profile_digest = request.chemistry_profile_digest;
  result.numerical_backend_profile_digest = request.numerical_backend_profile_digest;
  result.receptor_typing_assignment_digest = request.receptor_typing_assignment_digest;
  result.ligand_typing_assignment_digest = request.ligand_typing_assignment_digest;
  NeumaierSum inter_score;
  for (std::size_t term = 0; term < kTermCount; ++term) {
    result.decomposition.raw[term] = raw_sums[term].value();
    result.decomposition.weighted[term] = result.decomposition.raw[term] * kCoefficients[term];
    inter_score.add(result.decomposition.weighted[term]);
  }
  result.decomposition.inter_score = inter_score.value();
  result.decomposition.torsion_divisor = 1.0 + kTorsionDivisorCoefficient *
      static_cast<double>(request.scorer_torsion_count);
  result.decomposition.empirical_score =
      result.decomposition.inter_score / result.decomposition.torsion_divisor;
  if (!std::isfinite(result.decomposition.empirical_score)) {
    return invalid_result(request, "SCORING_NONFINITE_RESULT", "Scoring produced a nonfinite empirical score.");
  }
  return result;
}

}  // namespace mole::docking
