#pragma once

#include <array>
#include <cstddef>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace mole::docking {

inline constexpr std::string_view kScoringProfileId = "ME_DOCKING_V1_VINA_CLASSIC_1_0";
inline constexpr std::string_view kD3VinaTorsionProfileId = "ME_D3_VINA_TORSION_AUTODOCK_VINA_1_2_7_V1";
inline constexpr std::string_view kD3VinaTorsionProfileDigest = "sha256:0c042369f70f8a555930aa32cf2c0211abf93ef4bc837cdb389caff50e0edc6b";
inline constexpr std::string_view kTypingProfileId = "ME_XS_TYPING_V1_1_0";
inline constexpr std::string_view kChemistryProfileId = "ME_SUPPORTED_CHEMISTRY_V1_1_0";
inline constexpr std::string_view kBackendProfileId = "ME_DOCKING_V1_CPU_REFERENCE_NUMERIC_1_0";
inline constexpr std::string_view kReceptorProfileId = "ME_DOCKING_V1_RECEPTOR_CORE_DRY_1_0";
inline constexpr double kPhysicalCutoffAngstrom = 8.0;
inline constexpr double kTorsionDivisorCoefficient = 0.05846;

enum class Term : std::size_t { Gaussian1, Gaussian2, Repulsion, Hydrophobic, HydrogenBond, Count };
inline constexpr std::size_t kTermCount = static_cast<std::size_t>(Term::Count);
inline constexpr std::array<double, kTermCount> kScoringTermCoefficients{
    -0.035579, -0.005156, 0.840245, -0.035069, -0.587439};
using RawTerms = std::array<double, kTermCount>;

struct Vec3 final {
  double x{};
  double y{};
  double z{};
};

struct Atom final {
  std::string atom_uid;
  std::string xs_type;
  Vec3 position;
  std::optional<int> formal_charge{};
  std::optional<double> imported_partial_charge{};
  std::string element{};
  bool scoring_center{true};
};

enum class TypingStatus { Supported, Ambiguous, Unsupported };

struct TypingFeatures final {
  std::string_view element;
  std::optional<bool> carbon_bonded_to_heteroatom;
  std::optional<bool> donor;
  std::optional<bool> acceptor;
};

struct TypingAssignment final {
  TypingStatus status{TypingStatus::Unsupported};
  std::string_view type_id;
  std::string_view diagnostic_code;
};

struct VinaScorerTorsionAssignmentReference final {
  std::string profile_id;
  std::string profile_digest;
  std::string assignment_digest;
  double n_tors_vina{};
};

enum class SiteClass { DryCore, FixedWater, MobileWater, Ion, Metal, Cofactor, WaterDependent, Unknown };

struct Request final {
  std::string receptor_state_digest;
  std::string ligand_state_digest;
  std::string coordinate_state_digest;
  std::string search_region_digest;
  std::string receptor_profile_id;
  std::string scoring_profile_id;
  std::string scoring_profile_digest;
  std::string receptor_typing_profile_id;
  std::string ligand_typing_profile_id;
  std::string typing_profile_digest;
  std::string receptor_typing_assignment_digest;
  std::string ligand_typing_assignment_digest;
  std::string chemistry_profile_id;
  std::string chemistry_profile_digest;
  std::string numerical_backend_profile_id;
  std::string numerical_backend_profile_digest;
  SiteClass site_class{SiteClass::Unknown};
  std::string coordinate_units;
  std::vector<Atom> receptor_atoms;
  std::vector<Atom> ligand_atoms;
  std::size_t search_torsion_count{};
  VinaScorerTorsionAssignmentReference scorer_torsion_assignment;
};

struct Decomposition final {
  std::array<double, kTermCount> raw{};
  std::array<double, kTermCount> weighted{};
  double inter_score{};
  double torsion_divisor{};
  double empirical_score{};
};

struct Result final {
  bool valid{};
  bool gradient_valid{true};
  // INVALID_GRADIENT when a ligand/receptor pair has r = 0: the score stays
  // finite but no gradient direction exists (never zeroed or perturbed).
  std::string gradient_diagnostic_code;
  std::string diagnostic_code;
  std::string diagnostic;
  Decomposition decomposition;
  std::string scoring_profile_id{ kScoringProfileId };
  std::string typing_profile_id{ kTypingProfileId };
  std::string chemistry_profile_id{ kChemistryProfileId };
  std::string numerical_backend_profile_id{ kBackendProfileId };
  std::string scoring_profile_digest;
  std::string typing_profile_digest;
  std::string chemistry_profile_digest;
  std::string numerical_backend_profile_digest;
  std::string receptor_typing_assignment_digest;
  std::string ligand_typing_assignment_digest;
  std::string scorer_torsion_profile_id;
  std::string scorer_torsion_profile_digest;
  std::string scorer_torsion_assignment_digest;
  double n_tors_vina{};
  std::string receptor_state_digest;
  std::string ligand_state_digest;
  std::string coordinate_state_digest;
  std::string search_region_digest;
};

// Parses only the closed XS vocabulary. Unknown values fail closed; there is no
// element-based or partial-charge-based fallback in the scorer.
[[nodiscard]] std::optional<double> xs_radius(std::string_view type) noexcept;
[[nodiscard]] bool xs_element_matches(std::string_view type, std::string_view element) noexcept;
[[nodiscard]] TypingAssignment assign_xs_type(const TypingFeatures& features) noexcept;
[[nodiscard]] bool xs_hydrophobic(std::string_view type) noexcept;
[[nodiscard]] bool xs_donor(std::string_view type) noexcept;
[[nodiscard]] bool xs_acceptor(std::string_view type) noexcept;

// Shared raw Vina-classical pair primitive. Unsupported XS labels or invalid
// distances return nullopt; both the direct oracle and scoring-field builder
// use this implementation.
[[nodiscard]] std::optional<RawTerms> score_pair_terms(std::string_view receptor_xs_type,
                                                       std::string_view ligand_xs_type,
                                                       double distance) noexcept;

// Evaluates the direct receptor-ligand score. Atom arrays are sorted by stable
// AtomUID internally so caller order cannot affect pair or summation order.
[[nodiscard]] Result score_direct(const Request& request);

}  // namespace mole::docking
