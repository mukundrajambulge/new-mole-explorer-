#define NOMINMAX

#include "mole/docking/scoring_field.hpp"

#include <algorithm>
#include <array>
#include <bit>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
#include <utility>
#include <vector>

#if defined(_WIN32)
#include <windows.h>
#include <psapi.h>
#elif defined(__unix__)
#include <sys/resource.h>
#endif

namespace {

using mole::docking::Atom;
using mole::docking::AxisAlignedBox;
using mole::docking::ScoringField;
using mole::docking::ScoringFieldBuildRequest;
using mole::docking::ScoringFieldDependencies;
using mole::docking::ScoringFieldGeometry;
using mole::docking::ScoringFieldLogicalIdentity;
using mole::docking::ScoringFieldStorageIdentity;
using mole::docking::SiteClass;
using mole::docking::Vec3;

constexpr double kTolerance = 2.0e-14;
constexpr std::size_t kSmallPointCount = 64U;

void require(bool condition, const std::string& message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(1);
  }
}

bool close(double actual, double expected) {
  return std::abs(actual - expected) <= kTolerance * std::max(1.0, std::abs(expected));
}

std::string element_for(std::string_view type) {
  if (type.starts_with("C_")) return "C";
  if (type.starts_with("N_")) return "N";
  if (type.starts_with("O_")) return "O";
  if (type == "S_P") return "S";
  if (type == "P_P") return "P";
  if (type == "F_H") return "F";
  if (type == "Cl_H") return "Cl";
  if (type == "Br_H") return "Br";
  if (type == "I_H") return "I";
  return {};
}

Atom atom(std::string uid, std::string type, Vec3 position) {
  return Atom{std::move(uid), type, position, 0, std::nullopt,
              element_for(type), true};
}

ScoringFieldDependencies dependencies() {
  ScoringFieldDependencies value;
  value.receptor_state_digest = "sha256:" + std::string(64, '1');
  value.receptor_typing_assignment_digest = "sha256:" + std::string(64, '2');
  value.search_region_digest = "sha256:" + std::string(64, '3');
  value.scoring_profile_digest = "sha256:" + std::string(64, '4');
  value.typing_profile_digest = "sha256:" + std::string(64, '5');
  value.chemistry_profile_digest = "sha256:" + std::string(64, '6');
  value.numerical_backend_profile_digest = "sha256:" + std::string(64, '7');
  return value;
}

ScoringFieldBuildRequest request_for(std::vector<Atom> receptor_atoms,
                                     AxisAlignedBox search_region = {
                                         Vec3{-0.5, -0.5, -0.5}, Vec3{0.5, 0.5, 0.5}}) {
  ScoringFieldBuildRequest request;
  request.dependencies = dependencies();
  request.search_region = search_region;
  request.receptor_atoms = std::move(receptor_atoms);
  request.site_class = SiteClass::DryCore;
  request.coordinate_units = "ANGSTROM";
  request.site_influence_complete = true;
  return request;
}

std::size_t flat_index(const ScoringFieldGeometry& geometry,
                       std::size_t x, std::size_t y, std::size_t z) {
  return (x * geometry.point_counts[1] + y) * geometry.point_counts[2] + z;
}

double grid_coordinate(double origin, std::size_t index) {
  return origin + static_cast<double>(index) * mole::docking::kScoringFieldGridSpacingAngstrom;
}

void test_channel_table_and_zero_bits() {
  using namespace mole::docking;
  constexpr std::array<std::size_t, 21> expected_omitted{
      4, 8, 9, 13, 14, 18, 23, 28, 33, 34, 38, 43, 48, 53, 54, 58, 59, 64, 69, 74, 79};

  std::size_t physical_count = 0U;
  std::vector<std::size_t> omitted;
  for (std::size_t logical = 0; logical < kLogicalChannelCount; ++logical) {
    const auto mapped = physical_channel_ordinal(logical);
    if (mapped) {
      require(*mapped == physical_count, "physical ordinals follow canonical logical-channel order");
      ++physical_count;
    } else {
      omitted.push_back(logical);
    }
    require(logical_channel_is_physical(logical) == mapped.has_value(),
            "compile-time physical predicate agrees with the 80-to-59 map");
  }
  require(physical_count == kPhysicalChannelCount, "exactly 59 physical arrays are retained");
  require(omitted.size() == 21U, "exactly 21 channels are omitted");
  require(std::equal(omitted.begin(), omitted.end(), expected_omitted.begin()),
          "the exact-zero table matches the approved 21 logical channel IDs");
  require(kCanonicalXsTypes.size() == 16U && kTermCount == 5U,
          "canonical schema exposes all 16 XS types and 5 raw terms");
  for (std::size_t xs = 0; xs < kCanonicalXsTypes.size(); ++xs) {
    for (std::size_t term = 0; term < kTermCount; ++term) {
      require(logical_channel_id(xs, term) == 5U * xs + term,
              "logical channel ID remains 5*XS_ID+TERM_ID");
    }
  }

  auto built = build_scoring_field(request_for({atom("r1", "C_H", Vec3{0.125, 0.125, 0.125})}));
  require(built.valid && built.field != nullptr, "small supported receptor builds a field");
  const ScoringField& field = *built.field;
  const std::size_t point = flat_index(field.geometry(), 2U, 2U, 2U);
  for (const std::size_t logical : omitted) {
    const auto value = field.logical_raw_value(logical, point);
    require(value.has_value() && *value == 0.0 && !std::signbit(*value),
            "every omitted channel materializes as IEEE-754 +0.0");
    require(std::bit_cast<std::uint64_t>(*value) == 0x0000000000000000ULL,
            "every omitted channel has the exact positive-zero bit pattern");
    const std::size_t term = logical % kTermCount;
    const double weighted = *value * kScoringTermCoefficients[term];
    require(weighted == 0.0 && std::signbit(weighted),
            "negative scoring coefficient preserves weighted -0.0");
  }
  require(field.physical_channel_values(kPhysicalChannelCount).empty(),
          "physical lookup fails closed outside the 59 allocated arrays");
  require(!field.logical_raw_value(kLogicalChannelCount, point),
          "logical lookup fails closed outside the 80-channel schema");
  require(!field.logical_raw_value(0U, field.geometry().total_point_count),
          "logical lookup fails closed outside the field node range");
}

void test_pair_terms_and_node_construction() {
  using namespace mole::docking;
  for (const std::string_view receptor_type : kCanonicalXsTypes) {
    const Vec3 query{grid_coordinate(-0.875, 2U), grid_coordinate(-0.875, 2U),
                     grid_coordinate(-0.875, 2U)};
    const Vec3 receptor_position{query.x + 3.7, query.y, query.z};
    const double dx = receptor_position.x - query.x;
    const double distance = std::hypot(std::hypot(dx, 0.0), 0.0);
    const auto built = build_scoring_field(request_for({atom("r1", std::string(receptor_type),
                                                             receptor_position)}));
    require(built.valid && built.field, "each canonical receptor XS type builds field nodes");
    const std::size_t point = flat_index(built.field->geometry(), 2U, 2U, 2U);
    for (std::size_t ligand_xs = 0; ligand_xs < kCanonicalXsTypes.size(); ++ligand_xs) {
      const std::string_view ligand_type = kCanonicalXsTypes[ligand_xs];
      const auto expected = score_pair_terms(receptor_type, ligand_type, distance);
      require(expected.has_value(), "every supported receptor/ligand XS pair has a primitive");
      const auto sample = built.field->interpolate(ligand_type, query);
      require(sample.status == ScoringFieldStatus::Valid,
              "every canonical ligand XS channel interpolates at a grid node");
      for (std::size_t term = 0; term < kTermCount; ++term) {
        require(close(sample.raw[term], (*expected)[term]),
                "grid-node term matches the shared direct pair primitive");
      }
    }
    (void)point;
  }

  const auto c_h_radius = xs_radius("C_H");
  require(c_h_radius.has_value(), "C_H radius is available");
  const double sum_radius = *c_h_radius + *c_h_radius;
  const auto hydro_plateau = score_pair_terms("C_H", "C_H", sum_radius + 0.5);
  const auto hydro_shoulder = score_pair_terms("C_H", "C_H", sum_radius + 1.0);
  const auto hydro_zero = score_pair_terms("C_H", "C_H", sum_radius + 1.5);
  require(hydro_plateau && (*hydro_plateau)[3] == 1.0 && hydro_shoulder &&
              close((*hydro_shoulder)[3], 0.5) && hydro_zero && (*hydro_zero)[3] == 0.0,
          "hydrophobic plateau, shoulder and zero breakpoints are implemented");
  const auto hb_plateau = score_pair_terms("N_D", "N_A",
                                          std::nextafter(3.6 - 0.7, 0.0));
  const auto hb_zero = score_pair_terms("N_D", "N_A", 3.6);
  require(hb_plateau && (*hb_plateau)[4] == 1.0 && hb_zero && (*hb_zero)[4] == 0.0,
          "hydrogen-bond plateau and zero breakpoints are implemented");
  require(!score_pair_terms("B", "C_H", 2.0), "unsupported XS chemistry returns no pair primitive");
  require(!score_pair_terms("C_H", "C_H", std::numeric_limits<double>::infinity()),
          "nonfinite pair distance is rejected");
}

void test_cutoff_and_interpolation_stencil() {
  using namespace mole::docking;
  const Vec3 query{-0.125, -0.125, -0.125};
  for (const double distance : {7.999999, 8.0, 8.000001}) {
    const auto built = build_scoring_field(
        request_for({atom("r1", "N_D", Vec3{query.x + distance, query.y, query.z})}));
    require(built.valid && built.field, "cutoff shell receptor field builds");
    const auto sample = built.field->interpolate("N_A", query);
    const auto expected = score_pair_terms("N_D", "N_A", distance);
    require(sample.status == ScoringFieldStatus::Valid && expected,
            "cutoff shell has a valid complete grid stencil");
    for (std::size_t term = 0; term < kTermCount; ++term) {
      require(close(sample.raw[term], (*expected)[term]),
              "exact-node cutoff shell agrees with the direct primitive");
    }
    if (distance >= 8.0) {
      for (const double raw : sample.raw) require(raw == 0.0, "at and above 8 A every raw term is zero");
    }
  }

  const auto built = build_scoring_field(request_for({atom("r1", "N_D", Vec3{0.125, -0.125, 0.125})}));
  require(built.valid && built.field, "interpolation fixture field builds");
  const ScoringField& field = *built.field;
  const auto& geometry = field.geometry();
  const std::size_t logical_g1 = logical_channel_id(0U, static_cast<std::size_t>(Term::Gaussian1));
  for (std::size_t a = 0; a < 2U; ++a) {
    for (std::size_t b = 0; b < 2U; ++b) {
      for (std::size_t c = 0; c < 2U; ++c) {
        const Vec3 corner{grid_coordinate(geometry.origin.x, 3U + a),
                          grid_coordinate(geometry.origin.y, 3U + b),
                          grid_coordinate(geometry.origin.z, 3U + c)};
        const auto sample = field.interpolate("C_H", corner);
        require(sample.status == ScoringFieldStatus::Valid,
                "all eight exact corner grid nodes have complete stencils");
        const auto raw = field.logical_raw_value(logical_g1,
                                                 flat_index(geometry, 3U + a, 3U + b, 3U + c));
        require(raw && sample.raw[0] == *raw, "corner query returns its exact channel node");
      }
    }
  }

  const double half = geometry.spacing_angstrom * 0.5;
  const Vec3 center{grid_coordinate(geometry.origin.x, 3U) + half,
                    grid_coordinate(geometry.origin.y, 3U) + half,
                    grid_coordinate(geometry.origin.z, 3U) + half};
  const auto center_sample = field.interpolate("C_H", center);
  require(center_sample.status == ScoringFieldStatus::Valid,
          "arbitrary fractional cell-center query is interpolated");
  double center_oracle = 0.0;
  for (std::size_t a = 0; a < 2U; ++a) {
    for (std::size_t b = 0; b < 2U; ++b) {
      for (std::size_t c = 0; c < 2U; ++c) {
        const auto value = field.logical_raw_value(
            logical_g1, flat_index(geometry, 3U + a, 3U + b, 3U + c));
        require(value.has_value(), "all center interpolation corners exist");
        center_oracle += *value / 8.0;
      }
    }
  }
  require(close(center_sample.raw[0], center_oracle), "cell-center interpolation is the equal-weight corner sum");

  const Vec3 face{center.x, grid_coordinate(geometry.origin.y, 3U), center.z};
  const auto face_sample = field.interpolate("C_H", face);
  require(face_sample.status == ScoringFieldStatus::Valid, "cell-face stencil is complete");
  const Vec3 edge{grid_coordinate(geometry.origin.x, 3U), center.y,
                  grid_coordinate(geometry.origin.z, 3U)};
  require(field.interpolate("C_H", edge).status == ScoringFieldStatus::Valid,
          "cell-edge stencil is complete");

  const Vec3 domain_min = geometry.origin;
  const Vec3 domain_max = geometry.domain_maximum;
  require(field.interpolate("C_H", domain_min).status == ScoringFieldStatus::Valid &&
              field.interpolate("C_H", domain_max).status == ScoringFieldStatus::Valid,
          "both halo boundaries have complete interpolation stencils");
  const Vec3 below{std::nextafter(domain_min.x, -std::numeric_limits<double>::infinity()),
                   domain_min.y, domain_min.z};
  const Vec3 above{std::nextafter(domain_max.x, std::numeric_limits<double>::infinity()),
                   domain_max.y, domain_max.z};
  require(field.interpolate("C_H", below).status == ScoringFieldStatus::OutOfDomain &&
              field.interpolate("C_H", above).status == ScoringFieldStatus::OutOfDomain,
          "queries one ULP beyond either field boundary fail as out of domain");
  require(field.interpolate("B", center).status == ScoringFieldStatus::ChannelMissing,
          "unsupported ligand XS lookup fails closed without zero fallback");
}

struct DenseValues final {
  std::array<double, mole::docking::kLogicalChannelCount * kSmallPointCount> values{};
};

double dense_reader(const void* context, std::size_t logical, std::size_t point) noexcept {
  const auto* dense = static_cast<const DenseValues*>(context);
  return dense->values[logical * kSmallPointCount + point];
}

struct SparseValues final {
  std::array<double, mole::docking::kPhysicalChannelCount * kSmallPointCount> values{};
};

double sparse_reader(const void* context, std::size_t logical, std::size_t point) noexcept {
  const auto* sparse = static_cast<const SparseValues*>(context);
  const auto ordinal = mole::docking::physical_channel_ordinal(logical);
  if (!ordinal) return 0.0;
  return sparse->values[*ordinal * kSmallPointCount + point];
}

void test_logical_digest_and_physical_cache_identity() {
  using namespace mole::docking;
  ScoringFieldLogicalIdentity identity;
  identity.dependencies = dependencies();
  identity.geometry.search_region = AxisAlignedBox{Vec3{0.0, 0.0, 0.0}, Vec3{0.1, 0.1, 0.1}};
  identity.geometry.origin = Vec3{-0.375, -0.375, -0.375};
  identity.geometry.domain_maximum = Vec3{0.75, 0.75, 0.75};
  identity.geometry.spacing_angstrom = 0.375;
  identity.geometry.point_counts = {4U, 4U, 4U};
  identity.geometry.total_point_count = kSmallPointCount;

  DenseValues dense;
  SparseValues sparse;
  for (std::size_t logical = 0; logical < kLogicalChannelCount; ++logical) {
    for (std::size_t point = 0; point < kSmallPointCount; ++point) {
      const double value = logical_channel_is_physical(logical)
          ? static_cast<double>(logical * 3U + point + 1U) / 16.0
          : -0.0;
      dense.values[logical * kSmallPointCount + point] = value;
      const auto physical = physical_channel_ordinal(logical);
      if (physical) sparse.values[*physical * kSmallPointCount + point] = value;
    }
  }
  const std::string dense_digest = compute_logical_scoring_field_digest(identity, dense_reader, &dense);
  const std::string sparse_digest = compute_logical_scoring_field_digest(identity, sparse_reader, &sparse);
  require(!dense_digest.empty() && dense_digest == sparse_digest,
          "dense and exact-zero sparse storage produce equal logical digests");
  require(dense_digest ==
              "sha256:a4943906c807e256972c7d575e6ae69353b70e0d04d88be8704f89e011f53a69",
          "native logical digest matches the cross-language canonical-CBOR fixture");
  dense.values[0] = -0.0;
  const std::string negative_zero_digest = compute_logical_scoring_field_digest(identity, dense_reader, &dense);
  require(negative_zero_digest != dense_digest,
          "canonical F64Bits preserves +0.0 versus -0.0 in retained raw logical values");

  ScoringFieldStorageIdentity cached;
  cached.logical_digest = dense_digest;
  cached.physical_payload_digest = "sha256:" + std::string(64, '8');
  cached.identity_digest = "sha256:" + std::string(64, '9');
  // The payload hash is a real SHA-256 value, but the identity digest must also
  // be generated from its canonical storage envelope. Obtain that through a
  // production field below before asking the cache helper to trust the entry.
  auto built = build_scoring_field(request_for({atom("r1", "C_H", Vec3{0.125, 0.125, 0.125})}));
  require(built.valid && built.field, "cache identity fixture builds a production field");
  cached = built.field->storage_identity();
  require(validate_scoring_field_storage_identity(cached), "production physical-storage identity verifies");
  ScoringFieldStorageIdentity required = cached;
  required.physical_payload_digest.clear();
  required.identity_digest.clear();
  require(scoring_field_cache_compatible(cached, required),
          "cache reuse accepts the matching logical digest and physical storage schema");
  required.logical_digest = "sha256:" + std::string(64, 'a');
  require(!scoring_field_cache_compatible(cached, required), "cache rejects a different logical field digest");
  required = cached;
  required.physical_layout_id = "ME_SCORING_FIELD_DENSE_80_F64_V1";
  require(!scoring_field_cache_compatible(cached, required), "cache rejects an incompatible physical layout");
  required = cached;
  required.schema_id = "SCORING_FIELD_STORAGE_V2";
  require(!scoring_field_cache_compatible(cached, required), "cache rejects an incompatible physical schema version");
  required = cached;
  required.physical_payload_digest[7] = required.physical_payload_digest[7] == 'a' ? 'b' : 'a';
  require(!scoring_field_cache_compatible(cached, required), "cache rejects physical-payload digest mismatch");
  cached.identity_digest[7] = cached.identity_digest[7] == 'a' ? 'b' : 'a';
  require(!validate_scoring_field_storage_identity(cached), "cache rejects a tampered physical identity envelope");
}

void test_fail_closed_build_validation() {
  using namespace mole::docking;
  auto request = request_for({atom("r1", "C_H", Vec3{0.0, 0.0, 0.0})});
  request.site_influence_complete = false;
  require(build_scoring_field(request).diagnostic_code == "SCORING_FIELD_BUILD_FAILED",
          "field construction requires site-influence completeness evidence");
  request = request_for({atom("r1", "C_H", Vec3{0.0, 0.0, 0.0})});
  request.coordinate_units = "NANOMETER";
  require(build_scoring_field(request).diagnostic_code == "INVALID_COORDINATE_UNITS",
          "non-Angstrom field inputs are rejected");
  request = request_for({atom("r1", "B", Vec3{0.0, 0.0, 0.0})});
  require(build_scoring_field(request).diagnostic_code == "SCORING_ATOM_TYPE_UNSUPPORTED",
          "unsupported receptor chemistry fails instead of being omitted");
  request = request_for({atom("r1", "C_H", Vec3{0.0, 0.0, 0.0}),
                         atom("r1", "C_H", Vec3{1.0, 0.0, 0.0})});
  require(build_scoring_field(request).diagnostic_code == "SCORING_FIELD_BUILD_FAILED",
          "ambiguous duplicate receptor AtomUID fails closed");
  request = request_for({atom("r1", "C_H", Vec3{0.0, 0.0, 0.0})},
                        AxisAlignedBox{Vec3{0.0, 0.0, 0.0}, Vec3{41.0, 1.0, 1.0}});
  require(build_scoring_field(request).diagnostic_code == "SCORING_FIELD_BUILD_FAILED",
          "geometry beyond the 40 Angstrom side limit is rejected");
  request = request_for({atom("r1", "C_H", Vec3{0.0, 0.0, 0.0})});
  request.dependencies.scoring_profile_digest = "bad-digest";
  require(build_scoring_field(request).diagnostic_code == "INVALID_PROVENANCE_DIGEST",
          "invalid scientific dependency digest fails closed");
}

std::uint64_t peak_rss_bytes() {
#if defined(_WIN32)
  PROCESS_MEMORY_COUNTERS counters{};
  counters.cb = sizeof(counters);
  if (GetProcessMemoryInfo(GetCurrentProcess(), &counters, sizeof(counters)) == 0) return 0U;
  return static_cast<std::uint64_t>(counters.PeakWorkingSetSize);
#elif defined(__unix__)
  rusage usage{};
  if (getrusage(RUSAGE_SELF, &usage) != 0) return 0U;
  return static_cast<std::uint64_t>(usage.ru_maxrss) * 1024U;
#else
  return 0U;
#endif
}

void test_max_size_resource_measurement() {
  using namespace mole::docking;
  std::vector<Atom> receptor;
  receptor.reserve(kScoringFieldMaxReceptorAtoms);
  for (std::size_t index = 0; index < kScoringFieldMaxReceptorAtoms; ++index) {
    const double offset = static_cast<double>(index) * 0.001;
    receptor.push_back(atom("r" + std::to_string(index), "C_H",
                            Vec3{1000.0 + offset, 1000.0 + (offset * 0.25), 1000.0}));
  }
  const auto request = request_for(std::move(receptor),
      AxisAlignedBox{Vec3{-20.0, -20.0, -20.0}, Vec3{20.0, 20.0, 20.0}});
  const auto result = build_scoring_field(request);
  require(result.valid && result.field, "maximum-size production C++ field builds");
  const auto& usage = result.field->resource_usage();
  const std::uint64_t expected_raw = 1'331'000ULL * 59ULL * sizeof(double);
  require(usage.grid_point_count == 1'331'000ULL, "maximum geometry contains 1,331,000 points");
  require(usage.raw_payload_bytes == expected_raw && expected_raw == 628'232'000ULL,
          "production physical arrays allocate the architecture-level raw payload");
  require(usage.field_owned_allocation_bytes <= kScoringFieldMaxOwnedAllocationBytes,
          "measured field-owned allocation remains below 1 GiB");
  require(usage.construction_peak_owned_bytes <= kScoringFieldMaxOwnedAllocationBytes,
          "measured construction peak remains below the 1 GiB field-owned limit");
  const std::uint64_t rss = peak_rss_bytes();
  require(rss > 0U, "the resource fixture reads process RSS from the operating system");
  require(rss <= kScoringFieldDefaultAttemptRssBytes,
          "maximum field build remains below the 2 GiB default per-attempt RSS");
  std::cout << "RESOURCE raw_payload_bytes=" << usage.raw_payload_bytes
            << " field_owned_allocation_bytes=" << usage.field_owned_allocation_bytes
            << " retained_field_allocation_bytes=" << usage.retained_field_allocation_bytes
            << " construction_peak_owned_bytes=" << usage.construction_peak_owned_bytes
            << " peak_rss_bytes=" << rss
            << " receptor_scoring_atoms=" << usage.receptor_scoring_atom_count << '\n';
}

}  // namespace

int main() {
  test_channel_table_and_zero_bits();
  test_pair_terms_and_node_construction();
  test_cutoff_and_interpolation_stencil();
  test_logical_digest_and_physical_cache_identity();
  test_fail_closed_build_validation();
  test_max_size_resource_measurement();
  std::cout << "PASS: scoring-field unit fixtures (6 groups)\n";
  return 0;
}
