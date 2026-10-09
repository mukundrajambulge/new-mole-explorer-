#pragma once

#include "mole/docking/scoring.hpp"

#include <array>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <vector>

namespace mole::docking {

inline constexpr std::string_view kScoringFieldLogicalSchemaId = "SCORING_FIELD_LOGICAL_V2";
inline constexpr std::string_view kScoringFieldStorageSchemaId = "SCORING_FIELD_STORAGE_V1";
inline constexpr std::string_view kScoringFieldPhysicalLayoutId = "ME_SCORING_FIELD_80_TO_59_F64_V1";
inline constexpr std::string_view kScoringFieldCanonicalizationProfile = "ME_CANONICAL_CBOR_V1_1_0";
inline constexpr std::string_view kScoringFieldGridProfileId = "ME_VINA_GRID_V1_1_0";
inline constexpr double kScoringFieldGridSpacingAngstrom = 0.375;
inline constexpr std::size_t kLogicalChannelCount = 80;
inline constexpr std::size_t kPhysicalChannelCount = 59;
inline constexpr std::uint64_t kScoringFieldMaxRawPayloadBytes = 768ULL * 1024ULL * 1024ULL;
inline constexpr std::uint64_t kScoringFieldMaxOwnedAllocationBytes = 1024ULL * 1024ULL * 1024ULL;
inline constexpr std::uint64_t kScoringFieldDefaultAttemptRssBytes = 2ULL * 1024ULL * 1024ULL * 1024ULL;
inline constexpr std::uint64_t kScoringFieldOrdinaryV1SafetyRssBytes = 4ULL * 1024ULL * 1024ULL * 1024ULL;
inline constexpr std::size_t kScoringFieldMaxAxisPoints = 110;
inline constexpr std::size_t kScoringFieldMaxReceptorAtoms = 250000;

inline constexpr std::array<std::string_view, 16> kCanonicalXsTypes{
    "C_H", "C_P", "N_P", "N_D", "N_A", "N_DA", "O_P", "O_D", "O_A", "O_DA",
    "S_P", "P_P", "F_H", "Cl_H", "Br_H", "I_H"};
inline constexpr std::array<std::string_view, kTermCount> kCanonicalTermIds{
    "G1", "G2", "REP", "HYD", "HB"};

[[nodiscard]] constexpr std::size_t logical_channel_id(std::size_t xs_id,
                                                       std::size_t term_id) noexcept {
  return xs_id * kTermCount + term_id;
}

[[nodiscard]] constexpr bool logical_channel_is_physical(std::size_t logical_id) noexcept {
  if (logical_id >= kLogicalChannelCount) return false;
  const std::size_t xs_id = logical_id / kTermCount;
  const std::size_t term_id = logical_id % kTermCount;
  if (term_id < 3U) return true;
  if (term_id == static_cast<std::size_t>(Term::Hydrophobic)) {
    return xs_id == 0U || xs_id >= 12U;
  }
  return xs_id == 3U || xs_id == 4U || xs_id == 5U || xs_id == 7U ||
         xs_id == 8U || xs_id == 9U;
}

[[nodiscard]] consteval std::array<std::int16_t, kLogicalChannelCount>
make_logical_to_physical_channel_map() {
  std::array<std::int16_t, kLogicalChannelCount> mapping{};
  std::int16_t physical = 0;
  for (std::size_t logical = 0; logical < kLogicalChannelCount; ++logical) {
    if (logical_channel_is_physical(logical)) {
      mapping[logical] = physical++;
    } else {
      mapping[logical] = -1;
    }
  }
  return mapping;
}

inline constexpr auto kLogicalToPhysicalChannel = make_logical_to_physical_channel_map();
static_assert(kLogicalToPhysicalChannel[0] == 0);
static_assert(kLogicalToPhysicalChannel[3] == 3);
static_assert(kLogicalToPhysicalChannel[4] == -1);
static_assert(kLogicalToPhysicalChannel[78] == 58);
static_assert(kLogicalToPhysicalChannel[79] == -1);

struct ScoringFieldBuildRequest;
struct ScoringFieldBuildResult;
[[nodiscard]] ScoringFieldBuildResult build_scoring_field(
    const ScoringFieldBuildRequest& request);

[[nodiscard]] constexpr std::optional<std::size_t> physical_channel_ordinal(
    std::size_t logical_id) noexcept {
  if (logical_id >= kLogicalChannelCount) return std::nullopt;
  const auto physical = kLogicalToPhysicalChannel[logical_id];
  if (physical < 0) return std::nullopt;
  return static_cast<std::size_t>(physical);
}

struct AxisAlignedBox final {
  Vec3 minimum;
  Vec3 maximum;
};

struct ScoringFieldGeometry final {
  AxisAlignedBox search_region;
  Vec3 origin;
  Vec3 domain_maximum;
  double spacing_angstrom{kScoringFieldGridSpacingAngstrom};
  std::array<std::uint32_t, 3> point_counts{};
  std::size_t total_point_count{};
};

struct ScoringFieldDependencies final {
  std::string receptor_state_digest;
  std::string receptor_typing_assignment_digest;
  std::string search_region_digest;
  std::string receptor_profile_id{ kReceptorProfileId };
  std::string scoring_profile_id{ kScoringProfileId };
  std::string scoring_profile_digest;
  std::string typing_profile_id{ kTypingProfileId };
  std::string typing_profile_digest;
  std::string chemistry_profile_id{ kChemistryProfileId };
  std::string chemistry_profile_digest;
  std::string numerical_backend_profile_id{ kBackendProfileId };
  std::string numerical_backend_profile_digest;
};

struct ScoringFieldBuildRequest final {
  ScoringFieldDependencies dependencies;
  AxisAlignedBox search_region;
  std::vector<Atom> receptor_atoms;
  SiteClass site_class{SiteClass::Unknown};
  std::string coordinate_units;
  bool site_influence_complete{};
};

struct ScoringFieldResourceUsage final {
  std::uint64_t raw_payload_bytes{};
  std::uint64_t field_owned_allocation_bytes{};
  std::uint64_t retained_field_allocation_bytes{};
  std::uint64_t construction_peak_owned_bytes{};
  std::uint64_t grid_point_count{};
  std::uint32_t receptor_scoring_atom_count{};
};

struct ScoringFieldLogicalIdentity final {
  ScoringFieldDependencies dependencies;
  ScoringFieldGeometry geometry;
};

using LogicalChannelValueReader = double (*)(const void* context,
                                              std::size_t logical_channel,
                                              std::size_t point_index) noexcept;

// The reader is called in canonical logical-channel order and then x-major,
// y, z point order. An empty digest signals a non-finite value or bad input.
[[nodiscard]] std::string compute_logical_scoring_field_digest(
    const ScoringFieldLogicalIdentity& identity,
    LogicalChannelValueReader reader,
    const void* context);

struct ScoringFieldStorageIdentity final {
  std::string logical_digest;
  std::string schema_id{ kScoringFieldStorageSchemaId };
  std::string physical_layout_id{ kScoringFieldPhysicalLayoutId };
  std::string numeric_representation{"IEEE754_BINARY64_BIG_ENDIAN_BITS"};
  std::string physical_payload_digest;
  std::string identity_digest;
};

[[nodiscard]] bool scoring_field_cache_compatible(
    const ScoringFieldStorageIdentity& cached,
    const ScoringFieldStorageIdentity& required) noexcept;
[[nodiscard]] bool validate_scoring_field_storage_identity(
    const ScoringFieldStorageIdentity& identity) noexcept;

enum class ScoringFieldStatus { Valid, OutOfDomain, ChannelMissing, InvalidField, NonFinite };

// Stable diagnostic codes: Valid -> "", OutOfDomain -> SCORING_FIELD_OUT_OF_DOMAIN,
// ChannelMissing -> SCORING_FIELD_CHANNEL_MISSING, InvalidField ->
// SCORING_FIELD_INVALID, NonFinite -> SEARCH_OBJECTIVE_NONFINITE.
[[nodiscard]] std::string_view scoring_field_status_code(ScoringFieldStatus status) noexcept;

struct ScoringFieldSample final {
  ScoringFieldStatus status{ScoringFieldStatus::InvalidField};
  RawTerms raw{};
  RawTerms weighted{};
  double inter_score{};
};

// Value plus analytic trilinear gradient (PHD-V2-06 section 13; RESEARCH-DIGEST 8.2).
// raw/raw_gradient are the interpolated per-term channels; weights are applied
// after interpolation. The gradient is piecewise linear and discontinuous at
// cell faces: on a grid plane the higher cell is used when one exists, otherwise
// the last cell with fraction 1 (cell_lower records the cell actually used).
// There is no clamped, extrapolating or zero-filling mode: any query outside
// [origin, domain_maximum] on any axis is OutOfDomain.
struct ScoringFieldGradientSample final {
  ScoringFieldStatus status{ScoringFieldStatus::InvalidField};
  std::string_view diagnostic_code{"SCORING_FIELD_INVALID"};
  RawTerms raw{};
  RawTerms weighted{};
  std::array<Vec3, kTermCount> raw_gradient{};
  std::array<Vec3, kTermCount> weighted_gradient{};
  double inter_score{};
  Vec3 inter_gradient{};
  bool gradient_valid{};
  std::array<std::size_t, 3> cell_lower{};
};

class ScoringField final {
 public:
  ScoringField() = default;
  ScoringField(const ScoringField&) = delete;
  ScoringField& operator=(const ScoringField&) = delete;
  ScoringField(ScoringField&&) noexcept = default;
  ScoringField& operator=(ScoringField&&) noexcept = default;

  [[nodiscard]] bool valid() const noexcept { return !logical_digest_.empty(); }
  [[nodiscard]] const ScoringFieldGeometry& geometry() const noexcept { return geometry_; }
  [[nodiscard]] const ScoringFieldDependencies& dependencies() const noexcept { return dependencies_; }
  [[nodiscard]] const std::string& logical_digest() const noexcept { return logical_digest_; }
  [[nodiscard]] const ScoringFieldStorageIdentity& storage_identity() const noexcept {
    return storage_identity_;
  }
  [[nodiscard]] const ScoringFieldResourceUsage& resource_usage() const noexcept {
    return resource_usage_;
  }
  [[nodiscard]] std::span<const double> physical_channel_values(
      std::size_t physical_ordinal) const noexcept;
  [[nodiscard]] std::optional<double> logical_raw_value(
      std::size_t logical_channel,
      std::size_t point_index) const noexcept;
  [[nodiscard]] ScoringFieldSample interpolate(std::string_view ligand_xs_type,
                                               const Vec3& coordinate) const noexcept;
  [[nodiscard]] ScoringFieldGradientSample evaluate_with_gradient(
      std::string_view ligand_xs_type, const Vec3& coordinate) const noexcept;

 private:
  friend struct ScoringFieldBuildResult;
  friend ScoringFieldBuildResult build_scoring_field(const ScoringFieldBuildRequest& request);

  ScoringFieldGeometry geometry_;
  ScoringFieldDependencies dependencies_;
  std::array<std::unique_ptr<double[]>, kPhysicalChannelCount> physical_channels_{};
  std::string logical_digest_;
  ScoringFieldStorageIdentity storage_identity_;
  ScoringFieldResourceUsage resource_usage_;
};

struct ScoringFieldBuildResult final {
  bool valid{};
  std::string diagnostic_code;
  std::string diagnostic;
  std::unique_ptr<ScoringField> field;
};

[[nodiscard]] ScoringFieldBuildResult build_scoring_field(
    const ScoringFieldBuildRequest& request);

}  // namespace mole::docking
