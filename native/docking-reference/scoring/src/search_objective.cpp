#include "mole/docking/search_objective.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <string>

namespace mole::docking {
namespace {

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

[[nodiscard]] bool finite_point(const Vec3& value) noexcept {
  return std::isfinite(value.x) && std::isfinite(value.y) && std::isfinite(value.z);
}

[[nodiscard]] bool valid_region(const AxisAlignedBox& region) noexcept {
  return finite_point(region.minimum) && finite_point(region.maximum) &&
         region.minimum.x <= region.maximum.x && region.minimum.y <= region.maximum.y &&
         region.minimum.z <= region.maximum.z;
}

// Exact closed-interval test; no tolerance may enlarge the set.
[[nodiscard]] bool inside_closed(const Vec3& point, const AxisAlignedBox& region) noexcept {
  return region.minimum.x <= point.x && point.x <= region.maximum.x &&
         region.minimum.y <= point.y && point.y <= region.maximum.y &&
         region.minimum.z <= point.z && point.z <= region.maximum.z;
}

[[nodiscard]] bool is_hydrogen(const Atom& atom) noexcept { return atom.element == "H"; }

SearchRegionCheck region_result(SearchRegionAdmissibility status, std::string_view code,
                                std::size_t index) noexcept {
  SearchRegionCheck check;
  check.status = status;
  check.diagnostic_code = code;
  check.first_violation_index = index;
  return check;
}

template <typename Sequence, typename Position, typename Skip>
SearchRegionCheck check_region(const Sequence& atoms, const AxisAlignedBox& region,
                               Position position, Skip skip) noexcept {
  if (!valid_region(region)) {
    return region_result(SearchRegionAdmissibility::InvalidRegion, kSearchRegionInvalidCode, 0U);
  }
  std::size_t heavy_count = 0U;
  // Non-finite input wins over "outside" so a NaN pose is an abort, not a rejection.
  for (std::size_t index = 0; index < atoms.size(); ++index) {
    if (skip(atoms[index])) continue;
    if (!finite_point(position(atoms[index]))) {
      return region_result(SearchRegionAdmissibility::NonFinite, kSearchObjectiveNonfiniteCode, index);
    }
    ++heavy_count;
  }
  if (heavy_count == 0U) {
    return region_result(SearchRegionAdmissibility::NoHeavyAtoms, kSearchPoseNoHeavyAtomsCode, 0U);
  }
  for (std::size_t index = 0; index < atoms.size(); ++index) {
    if (skip(atoms[index])) continue;
    if (!inside_closed(position(atoms[index]), region)) {
      return region_result(SearchRegionAdmissibility::OutsideRegion, kSearchPoseOutsideRegionCode, index);
    }
  }
  return region_result(SearchRegionAdmissibility::Admissible, {}, 0U);
}

SearchObjectiveEvaluation objective_failure(SearchObjectiveStatus status, std::string_view code) {
  SearchObjectiveEvaluation evaluation;
  evaluation.status = status;
  evaluation.diagnostic_code = code;
  evaluation.gradient_valid = false;
  return evaluation;
}

}  // namespace

SearchRegionCheck search_region_admissible(std::span<const Vec3> heavy_atoms,
                                           const AxisAlignedBox& region) noexcept {
  return check_region(
      heavy_atoms, region, [](const Vec3& point) -> const Vec3& { return point; },
      [](const Vec3&) { return false; });
}

SearchRegionCheck search_region_admissible(std::span<const Atom> atoms,
                                           const AxisAlignedBox& region) noexcept {
  return check_region(
      atoms, region, [](const Atom& atom) -> const Vec3& { return atom.position; },
      [](const Atom& atom) { return is_hydrogen(atom); });
}

SearchObjectiveEvaluation evaluate_search_objective(const ScoringField& field,
                                                    std::span<const Atom> ligand_atoms,
                                                    const IntraNonbondedTerm& intra) {
  if (!field.valid()) {
    return objective_failure(SearchObjectiveStatus::Invalid, "SCORING_FIELD_INVALID");
  }
  if (intra.atom_gradient.size() != ligand_atoms.size()) {
    return objective_failure(SearchObjectiveStatus::Invalid, "SEARCH_OBJECTIVE_INTRA_SHAPE_MISMATCH");
  }
  if (!std::isfinite(intra.energy) ||
      std::any_of(intra.atom_gradient.begin(), intra.atom_gradient.end(),
                  [](const Vec3& g) { return !finite_point(g); })) {
    return objective_failure(SearchObjectiveStatus::Invalid, kSearchObjectiveNonfiniteCode);
  }

  std::vector<std::size_t> order(ligand_atoms.size());
  for (std::size_t index = 0; index < order.size(); ++index) order[index] = index;
  std::sort(order.begin(), order.end(), [&ligand_atoms](std::size_t left, std::size_t right) {
    return ligand_atoms[left].atom_uid < ligand_atoms[right].atom_uid;
  });
  for (std::size_t position = 0; position < order.size(); ++position) {
    const Atom& atom = ligand_atoms[order[position]];
    if (atom.atom_uid.empty() ||
        (position > 0U && ligand_atoms[order[position - 1U]].atom_uid == atom.atom_uid)) {
      return objective_failure(SearchObjectiveStatus::Invalid, "INVALID_ATOM_UID_ORDER");
    }
    if (!finite_point(atom.position)) {
      return objective_failure(SearchObjectiveStatus::Invalid, kSearchObjectiveNonfiniteCode);
    }
    if (!is_hydrogen(atom) && (!atom.scoring_center || atom.xs_type.empty())) {
      return objective_failure(SearchObjectiveStatus::Invalid, "SCORING_ATOM_TYPE_UNSUPPORTED");
    }
  }

  // Admissibility before any field call; an inadmissible pose is never scored.
  const auto region = search_region_admissible(ligand_atoms, field.geometry().search_region);
  if (region.status == SearchRegionAdmissibility::OutsideRegion) {
    return objective_failure(SearchObjectiveStatus::Inadmissible, region.diagnostic_code);
  }
  if (region.status != SearchRegionAdmissibility::Admissible) {
    return objective_failure(SearchObjectiveStatus::Invalid, region.diagnostic_code);
  }

  SearchObjectiveEvaluation evaluation;
  evaluation.field_queried = true;
  evaluation.atom_gradient.assign(ligand_atoms.size(), Vec3{});
  std::array<NeumaierSum, kTermCount> raw_sums{};
  for (const std::size_t index : order) {
    const Atom& atom = ligand_atoms[index];
    if (is_hydrogen(atom)) continue;
    const auto sample = field.evaluate_with_gradient(atom.xs_type, atom.position);
    if (sample.status != ScoringFieldStatus::Valid) {
      auto failed = objective_failure(SearchObjectiveStatus::Invalid, sample.diagnostic_code);
      failed.field_queried = true;
      // An admissible pose must have a complete stencil (ScoringFieldDomain is a
      // superset of the SearchRegion plus halo); anything else aborts the attempt.
      failed.domain_invariant_failure = sample.status == ScoringFieldStatus::OutOfDomain;
      return failed;
    }
    for (std::size_t term = 0; term < kTermCount; ++term) raw_sums[term].add(sample.raw[term]);
    evaluation.atom_gradient[index] = sample.inter_gradient;
  }
  NeumaierSum inter;
  for (std::size_t term = 0; term < kTermCount; ++term) {
    evaluation.inter_raw[term] = raw_sums[term].value();
    evaluation.inter_weighted[term] = evaluation.inter_raw[term] * kScoringTermCoefficients[term];
    inter.add(evaluation.inter_weighted[term]);
  }
  evaluation.e_inter = inter.value();
  evaluation.e_intra = intra.energy;
  evaluation.e_search = evaluation.e_inter + evaluation.e_intra;
  for (std::size_t index = 0; index < ligand_atoms.size(); ++index) {
    Vec3& gradient = evaluation.atom_gradient[index];
    gradient = Vec3{gradient.x + intra.atom_gradient[index].x, gradient.y + intra.atom_gradient[index].y,
                    gradient.z + intra.atom_gradient[index].z};
  }
  const bool finite_gradient = std::all_of(evaluation.atom_gradient.begin(), evaluation.atom_gradient.end(),
                                           [](const Vec3& g) { return finite_point(g); });
  if (!std::isfinite(evaluation.e_search) || !finite_gradient) {
    auto failed = objective_failure(SearchObjectiveStatus::Invalid, kSearchObjectiveNonfiniteCode);
    failed.field_queried = true;
    return failed;
  }
  evaluation.status = SearchObjectiveStatus::Valid;
  evaluation.gradient_valid = intra.gradient_valid;
  if (!intra.gradient_valid) evaluation.gradient_diagnostic_code = kInvalidGradientCode;
  return evaluation;
}

LineSearchResult backtracking_line_search(double initial_energy, double directional_derivative,
                                          const LineSearchAdmissibilityFn& admissible,
                                          const LineSearchScoreFn& score) {
  LineSearchResult result;
  if (!admissible || !score) {
    result.diagnostic_code = "LINE_SEARCH_CALLBACK_MISSING";
    return result;
  }
  if (!std::isfinite(initial_energy) || !std::isfinite(directional_derivative)) {
    result.diagnostic_code = kSearchObjectiveNonfiniteCode;
    return result;
  }
  if (!(directional_derivative < 0.0)) {
    result.diagnostic_code = "SEARCH_DIRECTION_NOT_DESCENT";
    return result;
  }
  double alpha = kLineSearchInitialStep;
  for (std::size_t trial = 0; trial < kLineSearchMaxTrials; ++trial) {
    result.trials = trial + 1U;
    result.alpha = alpha;
    const auto region = admissible(alpha);
    if (region.status == SearchRegionAdmissibility::OutsideRegion) {
      ++result.inadmissible_trials;  // Rejected unscored.
      alpha *= kLineSearchBacktrackFactor;
      continue;
    }
    if (region.status != SearchRegionAdmissibility::Admissible) {
      result.status = LineSearchStatus::Aborted;
      result.diagnostic_code = region.diagnostic_code;
      return result;
    }
    const auto scored = score(alpha);
    ++result.scored_trials;
    if (!scored.valid || !std::isfinite(scored.energy)) {
      result.status = LineSearchStatus::Aborted;
      result.diagnostic_code = !scored.valid && !scored.diagnostic_code.empty()
                                   ? scored.diagnostic_code
                                   : kSearchObjectiveNonfiniteCode;
      return result;
    }
    const double armijo_bound = initial_energy + (kLineSearchArmijoC1 * alpha) * directional_derivative;
    if (scored.energy <= armijo_bound) {
      result.status = LineSearchStatus::Accepted;
      result.diagnostic_code = {};
      result.energy = scored.energy;
      return result;
    }
    alpha *= kLineSearchBacktrackFactor;
  }
  if (result.inadmissible_trials == kLineSearchMaxTrials) {
    result.status = LineSearchStatus::BoundaryBlocked;
    result.diagnostic_code = kBoundaryBlockedCode;
  } else {
    result.status = LineSearchStatus::LineSearchFailed;
    result.diagnostic_code = kLineSearchFailedCode;
  }
  return result;
}

}  // namespace mole::docking
