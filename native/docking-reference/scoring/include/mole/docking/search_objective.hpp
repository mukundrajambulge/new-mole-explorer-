#pragma once

// Search-ready objective, hard SearchRegion admissibility and the line-search
// hook (RESEARCH-DIGEST 8.2; PHD-V2-05 sections 1/6, PHD-V2-06 section 13,
// PHD-V2-07 sections 3/8/13).
//
// E_search = E_inter + E_intra_nonbonded. There is no box, barrier, slope or
// clamping term anywhere: a pose with a heavy atom outside the closed
// SearchRegion is inadmissible and is rejected unscored. SearchRegion
// admissibility (SEARCH_POSE_OUTSIDE_REGION) and ScoringFieldDomain validity
// (SCORING_FIELD_OUT_OF_DOMAIN) are separate diagnostics.

#include "mole/docking/scoring.hpp"
#include "mole/docking/scoring_field.hpp"

#include <cstddef>
#include <functional>
#include <span>
#include <string_view>
#include <vector>

namespace mole::docking {

inline constexpr std::string_view kSearchRegionAdmissibilityRuleId =
    "ALL_LIGAND_HEAVY_ATOMS_IN_CLOSED_REGION_V1";

inline constexpr std::string_view kSearchPoseOutsideRegionCode = "SEARCH_POSE_OUTSIDE_REGION";
inline constexpr std::string_view kSearchRegionInvalidCode = "SEARCH_REGION_INVALID";
inline constexpr std::string_view kSearchPoseNoHeavyAtomsCode = "SEARCH_POSE_NO_HEAVY_ATOMS";
inline constexpr std::string_view kSearchObjectiveNonfiniteCode = "SEARCH_OBJECTIVE_NONFINITE";
inline constexpr std::string_view kScoringFieldOutOfDomainCode = "SCORING_FIELD_OUT_OF_DOMAIN";
inline constexpr std::string_view kInvalidGradientCode = "INVALID_GRADIENT";
inline constexpr std::string_view kBoundaryBlockedCode = "BOUNDARY_BLOCKED";
inline constexpr std::string_view kLineSearchFailedCode = "LINE_SEARCH_FAILED";

enum class SearchRegionAdmissibility { Admissible, OutsideRegion, NonFinite, NoHeavyAtoms, InvalidRegion };

struct SearchRegionCheck final {
  SearchRegionAdmissibility status{SearchRegionAdmissibility::InvalidRegion};
  std::string_view diagnostic_code{kSearchRegionInvalidCode};
  // Index (in the caller's sequence) of the first offending atom, if any.
  std::size_t first_violation_index{};
};

// Closed AABB, all heavy atoms, minimum <= x <= maximum on every axis, no
// epsilon: an atom exactly on a face is admissible, one ulp beyond is not.
// Non-finite coordinates are NonFinite (never "outside"), so callers abort.
[[nodiscard]] SearchRegionCheck search_region_admissible(std::span<const Vec3> heavy_atoms,
                                                        const AxisAlignedBox& region) noexcept;
// Atom overload: hydrogens (element "H") are ignored; every other atom counts.
[[nodiscard]] SearchRegionCheck search_region_admissible(std::span<const Atom> atoms,
                                                        const AxisAlignedBox& region) noexcept;

// E_intra_nonbonded is produced by the ligand intramolecular scorer (D4). The
// objective only adds it; it never invents or zero-fills it.
struct IntraNonbondedTerm final {
  double energy{};
  std::vector<Vec3> atom_gradient;  // dE_intra/dr_i, same order as the atoms.
  bool gradient_valid{true};
};

enum class SearchObjectiveStatus { Valid, Inadmissible, Invalid };

struct SearchObjectiveEvaluation final {
  SearchObjectiveStatus status{SearchObjectiveStatus::Invalid};
  std::string_view diagnostic_code;
  bool field_queried{};                 // False whenever admissibility failed.
  bool domain_invariant_failure{};      // Admissible pose but stencil outside the field.
  RawTerms inter_raw{};
  RawTerms inter_weighted{};
  double e_inter{};
  double e_intra{};
  double e_search{};
  std::vector<Vec3> atom_gradient;      // dE_search/dr_i, same order as the atoms.
  bool gradient_valid{};
  std::string_view gradient_diagnostic_code;
};

// Order: input validation -> admissibility against field.geometry().search_region
// (before any field call) -> per-heavy-atom field evaluation -> E_search.
// Per-term raw sums use Neumaier summation in stable AtomUID order.
[[nodiscard]] SearchObjectiveEvaluation evaluate_search_objective(
    const ScoringField& field, std::span<const Atom> ligand_atoms, const IntraNonbondedTerm& intra);

// Backtracking Armijo line search hook for the BFGS optimizer (PHD-V2-07):
// alpha0 = 1, factor 0.5, c1 = 1e-4, at most 10 trials. Each trial is first
// checked for admissibility; an inadmissible trial is never scored and halves
// alpha. All 10 trials inadmissible -> BOUNDARY_BLOCKED; feasible trials but
// none passes Armijo -> LINE_SEARCH_FAILED; non-finite or invalid -> Aborted.
inline constexpr double kLineSearchInitialStep = 1.0;
inline constexpr double kLineSearchBacktrackFactor = 0.5;
inline constexpr double kLineSearchArmijoC1 = 1.0e-4;
inline constexpr std::size_t kLineSearchMaxTrials = 10;

enum class LineSearchStatus { Accepted, BoundaryBlocked, LineSearchFailed, Aborted };

struct LineSearchScoredTrial final {
  bool valid{};
  double energy{};
  std::string_view diagnostic_code;
};

struct LineSearchResult final {
  LineSearchStatus status{LineSearchStatus::Aborted};
  std::string_view diagnostic_code;
  double alpha{};
  double energy{};
  std::size_t trials{};
  std::size_t inadmissible_trials{};
  std::size_t scored_trials{};
};

using LineSearchAdmissibilityFn = std::function<SearchRegionCheck(double alpha)>;
using LineSearchScoreFn = std::function<LineSearchScoredTrial(double alpha)>;

[[nodiscard]] LineSearchResult backtracking_line_search(double initial_energy,
                                                        double directional_derivative,
                                                        const LineSearchAdmissibilityFn& admissible,
                                                        const LineSearchScoreFn& score);

}  // namespace mole::docking
