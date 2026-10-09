// Task 4.8 (RESEARCH-DIGEST 8.2, PHD-V2-07/13): analytic trilinear gradients,
// grid-vs-reference tolerances, hard SearchRegion admissibility and the
// line-search boundary hook. All randomness is a fixed SplitMix64 stream.
#define NOMINMAX

#include "mole/docking/search_objective.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <limits>
#include <memory>
#include <span>
#include <string>
#include <utility>
#include <vector>

namespace {

using namespace mole::docking;

constexpr double kInf = std::numeric_limits<double>::infinity();
constexpr std::size_t kRandomPoints = 10000U;
// Declared central-difference step: 2^-12 A (exact binary fraction). Interior
// points keep a margin of 0.02 h = 0.0075 A from every cell face, so x +/- step
// never crosses a face where the trilinear gradient is discontinuous.
constexpr double kFiniteDifferenceStep = 1.0 / 4096.0;
constexpr double kFaceMarginFraction = 0.02;
constexpr double kFiniteDifferenceRel = 1.0e-6;
constexpr double kTermAbs = 1.0e-10;
constexpr double kGradientAbs = 1.0e-8;
constexpr double kGradientRel = 1.0e-7;

int g_checks = 0;

void require(bool condition, const std::string& message) {
  ++g_checks;
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(1);
  }
}

class SplitMix64 final {
 public:
  explicit SplitMix64(std::uint64_t seed) : state_(seed) {}
  std::uint64_t next() {
    std::uint64_t z = (state_ += 0x9E3779B97F4A7C15ULL);
    z = (z ^ (z >> 30U)) * 0xBF58476D1CE4E5B9ULL;
    z = (z ^ (z >> 27U)) * 0x94D049BB133111EBULL;
    return z ^ (z >> 31U);
  }
  // [0, 1) with 53 random bits.
  double unit() { return static_cast<double>(next() >> 11U) * 0x1.0p-53; }
  std::size_t below(std::size_t bound) { return static_cast<std::size_t>(next() % bound); }

 private:
  std::uint64_t state_;
};

std::string element_for(std::string_view type) {
  if (type.starts_with("Cl")) return "Cl";
  if (type.starts_with("Br")) return "Br";
  return std::string(type.substr(0, 1));
}

Atom atom(std::string uid, std::string type, Vec3 position) {
  const std::string element = element_for(type);
  return Atom{std::move(uid), std::move(type), position, 0, std::nullopt, element, true};
}

Atom hydrogen(std::string uid, Vec3 position) {
  return Atom{std::move(uid), "", position, 0, std::nullopt, "H", false};
}

ScoringFieldBuildRequest field_request(std::vector<Atom> receptor, AxisAlignedBox region) {
  ScoringFieldBuildRequest request;
  request.dependencies.receptor_state_digest = "sha256:" + std::string(64, '1');
  request.dependencies.receptor_typing_assignment_digest = "sha256:" + std::string(64, '2');
  request.dependencies.search_region_digest = "sha256:" + std::string(64, '3');
  request.dependencies.scoring_profile_digest = "sha256:" + std::string(64, '4');
  request.dependencies.typing_profile_digest = "sha256:" + std::string(64, '5');
  request.dependencies.chemistry_profile_digest = "sha256:" + std::string(64, '6');
  request.dependencies.numerical_backend_profile_digest = "sha256:" + std::string(64, '7');
  request.search_region = region;
  request.receptor_atoms = std::move(receptor);
  request.site_class = SiteClass::DryCore;
  request.coordinate_units = "ANGSTROM";
  request.site_influence_complete = true;
  return request;
}

const AxisAlignedBox kRegion{Vec3{-2.0, -1.5, -1.0}, Vec3{2.0, 1.75, 1.25}};

// Mixed receptor so every term channel (G1, G2, REP, HYD, HB) varies inside
// the domain; several atoms sit close enough to the box to make REP non-zero.
std::vector<Atom> receptor_atoms() {
  return {atom("r01", "C_H", Vec3{3.1, 0.4, 0.2}),   atom("r02", "N_D", Vec3{-3.0, 0.3, -0.4}),
          atom("r03", "O_A", Vec3{0.2, 3.2, 0.5}),   atom("r04", "O_DA", Vec3{-0.6, -2.9, 0.1}),
          atom("r05", "Cl_H", Vec3{0.5, 0.1, 2.6}),  atom("r06", "C_P", Vec3{-0.3, 0.2, -2.7}),
          atom("r07", "N_A", Vec3{2.4, -2.2, 1.9}),  atom("r08", "S_P", Vec3{-2.5, 2.6, -1.8}),
          atom("r09", "C_H", Vec3{1.2, 1.4, -2.3}),  atom("r10", "N_DA", Vec3{-1.9, -1.7, 2.2})};
}

const std::array<std::string_view, 6> kLigandTypes{"C_H", "N_DA", "O_A", "N_D", "Cl_H", "C_P"};

double node(double origin, std::size_t index) {
  return origin + static_cast<double>(index) * kScoringFieldGridSpacingAngstrom;
}

struct ReferenceSample final {
  RawTerms raw{};
  std::array<std::array<double, 3>, kTermCount> gradient{};
};

// Independent scalar reference: nested linear interpolation (lerp form) on
// the stored logical channels, with an explicit cell and fraction.
ReferenceSample reference_sample(const ScoringField& field, std::size_t xs,
                                 const std::array<std::size_t, 3>& lower,
                                 const std::array<double, 3>& t) {
  const auto& geometry = field.geometry();
  const double h = geometry.spacing_angstrom;
  ReferenceSample out;
  for (std::size_t term = 0; term < kTermCount; ++term) {
    double v[2][2][2]{};
    for (std::size_t a = 0; a < 2U; ++a) {
      for (std::size_t b = 0; b < 2U; ++b) {
        for (std::size_t c = 0; c < 2U; ++c) {
          const std::size_t index = ((lower[0] + a) * geometry.point_counts[1] + lower[1] + b) *
                                        geometry.point_counts[2] + lower[2] + c;
          const auto value = field.logical_raw_value(logical_channel_id(xs, term), index);
          require(value.has_value(), "reference corner exists");
          v[a][b][c] = *value;
        }
      }
    }
    const auto lerp = [](double p, double q, double s) { return p + s * (q - p); };
    // Bilinear in (y,z) at x = lower and x = lower+1, then along x.
    double yz[2]{};
    double dy[2]{};
    double dz[2]{};
    for (std::size_t a = 0; a < 2U; ++a) {
      const double z0 = lerp(v[a][0][0], v[a][0][1], t[2]);
      const double z1 = lerp(v[a][1][0], v[a][1][1], t[2]);
      yz[a] = lerp(z0, z1, t[1]);
      dy[a] = z1 - z0;
      dz[a] = lerp(v[a][0][1] - v[a][0][0], v[a][1][1] - v[a][1][0], t[1]);
    }
    out.raw[term] = lerp(yz[0], yz[1], t[0]);
    out.gradient[term] = {(yz[1] - yz[0]) / h, lerp(dy[0], dy[1], t[0]) / h,
                          lerp(dz[0], dz[1], t[0]) / h};
  }
  return out;
}

double component(const Vec3& v, std::size_t axis) { return axis == 0U ? v.x : axis == 1U ? v.y : v.z; }

Vec3 with_component(Vec3 v, std::size_t axis, double value) {
  if (axis == 0U) v.x = value;
  else if (axis == 1U) v.y = value;
  else v.z = value;
  return v;
}

std::size_t xs_index(std::string_view type) {
  for (std::size_t i = 0; i < kCanonicalXsTypes.size(); ++i) {
    if (kCanonicalXsTypes[i] == type) return i;
  }
  require(false, "known XS type");
  return 0;
}

struct Fixture final {
  std::unique_ptr<ScoringField> field;
  std::vector<Atom> receptor;
};

Fixture make_fixture() {
  Fixture fixture;
  fixture.receptor = receptor_atoms();
  auto built = build_scoring_field(field_request(fixture.receptor, kRegion));
  require(built.valid && built.field, "gradient fixture field builds");
  fixture.field = std::move(built.field);
  return fixture;
}

// Random interior point (away from faces) with its exact cell and fraction.
struct InteriorPoint final {
  Vec3 point;
  std::array<std::size_t, 3> lower{};
  std::array<double, 3> fraction{};
};

InteriorPoint interior_point(const ScoringFieldGeometry& geometry, SplitMix64& rng) {
  InteriorPoint p;
  const double origin[3]{geometry.origin.x, geometry.origin.y, geometry.origin.z};
  double coordinate[3]{};
  for (std::size_t axis = 0; axis < 3U; ++axis) {
    const std::size_t cells = geometry.point_counts[axis] - 1U;
    p.lower[axis] = rng.below(cells);
    const double lo = node(origin[axis], p.lower[axis]);
    const double fraction = kFaceMarginFraction + (1.0 - 2.0 * kFaceMarginFraction) * rng.unit();
    coordinate[axis] = lo + fraction * geometry.spacing_angstrom;
    p.fraction[axis] = (coordinate[axis] - lo) / geometry.spacing_angstrom;
  }
  p.point = Vec3{coordinate[0], coordinate[1], coordinate[2]};
  return p;
}

// 16 ulps of each sampled energy, propagated through the central quotient.
double fd_rounding_floor(double plus, double minus) {
  constexpr double kUlps = 16.0;
  return kUlps * std::numeric_limits<double>::epsilon() * (std::abs(plus) + std::abs(minus)) /
         (2.0 * kFiniteDifferenceStep);
}

void test_finite_difference_sanity(const Fixture& fixture) {
  const ScoringField& field = *fixture.field;
  SplitMix64 rng(0x4D3848ULL);
  double max_rel = 0.0;
  std::size_t compared = 0U;
  std::size_t floored = 0U;
  for (std::size_t i = 0; i < kRandomPoints; ++i) {
    const auto p = interior_point(field.geometry(), rng);
    const auto type = kLigandTypes[i % kLigandTypes.size()];
    const auto sample = field.evaluate_with_gradient(type, p.point);
    require(sample.status == ScoringFieldStatus::Valid && sample.gradient_valid,
            "interior FD point evaluates");
    for (std::size_t axis = 0; axis < 3U; ++axis) {
      const double x = component(p.point, axis);
      const auto plus = field.evaluate_with_gradient(type, with_component(p.point, axis, x + kFiniteDifferenceStep));
      const auto minus = field.evaluate_with_gradient(type, with_component(p.point, axis, x - kFiniteDifferenceStep));
      require(plus.status == ScoringFieldStatus::Valid && minus.status == ScoringFieldStatus::Valid,
              "FD stencil stays in the domain");
      require(plus.cell_lower == sample.cell_lower && minus.cell_lower == sample.cell_lower,
              "FD stencil stays inside one cell");
      for (std::size_t term = 0; term < kTermCount; ++term) {
        const double fd = (plus.raw[term] - minus.raw[term]) / (2.0 * kFiniteDifferenceStep);
        const double analytic = component(sample.raw_gradient[term], axis);
        const double scale = std::max(std::abs(analytic), std::abs(fd));
        if (scale == 0.0) continue;  // Identically zero channel: exact agreement.
        const double rel = std::abs(fd - analytic) / scale;
        ++compared;
        // Declared rounding floor of the FD quotient itself (not of the
        // analytic gradient): a few ulps of |E| divided by the 2*step span.
        const double floor = fd_rounding_floor(plus.raw[term], minus.raw[term]);
        if (std::abs(fd - analytic) <= floor && rel > kFiniteDifferenceRel) {
          ++floored;
          continue;
        }
        max_rel = std::max(max_rel, rel);
        if (rel > kFiniteDifferenceRel) {
          std::cerr << std::setprecision(17) << "FD term=" << term << " axis=" << axis << " fd=" << fd
                    << " analytic=" << analytic << " value=" << sample.raw[term] << '\n';
        }
        require(rel <= kFiniteDifferenceRel, "analytic gradient matches central FD (rel <= 1e-6)");
      }
      const double fd_total = (plus.inter_score - minus.inter_score) / (2.0 * kFiniteDifferenceStep);
      const double analytic_total = component(sample.inter_gradient, axis);
      const double scale = std::max(std::abs(fd_total), std::abs(analytic_total));
      if (scale > 0.0) {
        const double rel = std::abs(fd_total - analytic_total) / scale;
        const double floor = fd_rounding_floor(plus.inter_score, minus.inter_score);
        if (std::abs(fd_total - analytic_total) <= floor && rel > kFiniteDifferenceRel) {
          ++floored;
        } else {
          max_rel = std::max(max_rel, rel);
          require(rel <= kFiniteDifferenceRel, "weighted total gradient matches central FD");
        }
      }
    }
  }
  std::cout << std::setprecision(3) << "MEASURE fd_step=" << kFiniteDifferenceStep
            << " fd_points=" << kRandomPoints << " fd_components=" << compared
            << " fd_max_rel=" << max_rel << " fd_rounding_floor_components=" << floored << '\n';
}

void test_grid_vs_scalar_reference(const Fixture& fixture) {
  const ScoringField& field = *fixture.field;
  SplitMix64 rng(0x4D3849ULL);
  double max_term_abs = 0.0;
  double max_grad_abs = 0.0;
  double max_grad_rel = 0.0;
  for (std::size_t i = 0; i < kRandomPoints; ++i) {
    const auto p = interior_point(field.geometry(), rng);
    const auto type = kLigandTypes[i % kLigandTypes.size()];
    const auto sample = field.evaluate_with_gradient(type, p.point);
    require(sample.status == ScoringFieldStatus::Valid, "reference point evaluates");
    require(sample.cell_lower == p.lower, "cell selection matches the reference cell");
    const auto strict = field.interpolate(type, p.point);
    require(strict.status == ScoringFieldStatus::Valid && strict.inter_score == sample.inter_score,
            "gradient path value is bit-identical to strict interpolation");
    for (std::size_t term = 0; term < kTermCount; ++term) {
      require(strict.raw[term] == sample.raw[term], "strict raw term is bit-identical");
    }
    const auto reference = reference_sample(field, xs_index(type), p.lower, p.fraction);
    for (std::size_t term = 0; term < kTermCount; ++term) {
      const double term_abs = std::abs(sample.raw[term] - reference.raw[term]);
      max_term_abs = std::max(max_term_abs, term_abs);
      require(term_abs <= kTermAbs, "interpolated term abs <= 1e-10");
      require(sample.weighted[term] == sample.raw[term] * kScoringTermCoefficients[term],
              "weights are applied after interpolation");
      for (std::size_t axis = 0; axis < 3U; ++axis) {
        const double got = component(sample.raw_gradient[term], axis);
        const double want = reference.gradient[term][axis];
        const double abs_error = std::abs(got - want);
        const double scale = std::max(std::abs(got), std::abs(want));
        const double rel_error = scale == 0.0 ? 0.0 : abs_error / scale;
        max_grad_abs = std::max(max_grad_abs, abs_error);
        max_grad_rel = std::max(max_grad_rel, rel_error);
        require(abs_error <= kGradientAbs && rel_error <= kGradientRel,
                "gradient abs <= 1e-8 AND rel <= 1e-7 componentwise");
        require(component(sample.weighted_gradient[term], axis) == got * kScoringTermCoefficients[term],
                "gradient weights are applied after interpolation");
      }
    }
  }
  std::cout << std::setprecision(3) << "MEASURE grid_vs_reference points=" << kRandomPoints
            << " term_max_abs=" << max_term_abs << " grad_max_abs=" << max_grad_abs
            << " grad_max_rel=" << max_grad_rel << '\n';
}

void test_grid_nodes_vs_direct(const Fixture& fixture) {
  const ScoringField& field = *fixture.field;
  const auto& geometry = field.geometry();
  SplitMix64 rng(0x4D384AULL);
  double max_abs = 0.0;
  for (std::size_t i = 0; i < 2000U; ++i) {
    const Vec3 point{node(geometry.origin.x, rng.below(geometry.point_counts[0])),
                     node(geometry.origin.y, rng.below(geometry.point_counts[1])),
                     node(geometry.origin.z, rng.below(geometry.point_counts[2]))};
    const auto type = kLigandTypes[i % kLigandTypes.size()];
    const auto sample = field.evaluate_with_gradient(type, point);
    require(sample.status == ScoringFieldStatus::Valid, "grid node evaluates");
    RawTerms direct{};
    for (const Atom& receptor : fixture.receptor) {
      const double dx = receptor.position.x - point.x;
      const double dy = receptor.position.y - point.y;
      const double dz = receptor.position.z - point.z;
      const auto terms = score_pair_terms(receptor.xs_type, type, std::hypot(std::hypot(dx, dy), dz));
      require(terms.has_value(), "direct pair primitive");
      for (std::size_t term = 0; term < kTermCount; ++term) direct[term] += (*terms)[term];
    }
    for (std::size_t term = 0; term < kTermCount; ++term) {
      const double error = std::abs(sample.raw[term] - direct[term]);
      max_abs = std::max(max_abs, error);
      require(error <= kTermAbs, "grid node term equals scalar direct sum (abs <= 1e-10)");
    }
  }
  std::cout << std::setprecision(3) << "MEASURE grid_node_vs_direct nodes=2000 term_max_abs=" << max_abs << '\n';
}

void test_face_and_corner_cell_rule(const Fixture& fixture) {
  const ScoringField& field = *fixture.field;
  const auto& g = field.geometry();
  const std::size_t last[3]{g.point_counts[0] - 1U, g.point_counts[1] - 1U, g.point_counts[2] - 1U};
  const double half = 0.5 * g.spacing_angstrom;
  // Interior grid plane x = node 4: the higher cell (lower = 4, fraction 0).
  const Vec3 face{node(g.origin.x, 4U), node(g.origin.y, 2U) + half, node(g.origin.z, 3U) + half};
  const auto face_sample = field.evaluate_with_gradient("C_H", face);
  require(face_sample.status == ScoringFieldStatus::Valid &&
              face_sample.cell_lower == std::array<std::size_t, 3>{4U, 2U, 3U},
          "on an interior grid plane the higher cell is selected");
  const auto face_ref = reference_sample(field, 0U, {4U, 2U, 3U}, {0.0, 0.5, 0.5});
  for (std::size_t term = 0; term < kTermCount; ++term) {
    for (std::size_t axis = 0; axis < 3U; ++axis) {
      require(std::abs(component(face_sample.raw_gradient[term], axis) - face_ref.gradient[term][axis]) <=
                  kGradientAbs,
              "face gradient is the higher cell's one-sided gradient");
    }
  }
  // Last plane on every axis (domain maximum corner): no higher cell exists.
  const auto max_corner = field.evaluate_with_gradient("O_A", g.domain_maximum);
  require(max_corner.status == ScoringFieldStatus::Valid &&
              max_corner.cell_lower ==
                  std::array<std::size_t, 3>{last[0] - 1U, last[1] - 1U, last[2] - 1U},
          "domain-maximum corner uses the last cell with fraction 1");
  const auto max_ref = reference_sample(field, xs_index("O_A"), max_corner.cell_lower, {1.0, 1.0, 1.0});
  for (std::size_t term = 0; term < kTermCount; ++term) {
    require(std::abs(max_corner.raw[term] - max_ref.raw[term]) <= kTermAbs, "max corner value");
  }
  const auto min_corner = field.evaluate_with_gradient("O_A", g.origin);
  require(min_corner.status == ScoringFieldStatus::Valid &&
              min_corner.cell_lower == std::array<std::size_t, 3>{0U, 0U, 0U},
          "domain-origin corner uses the first cell");
  // Exact out-of-domain classification: one ulp beyond either boundary per axis.
  for (std::size_t axis = 0; axis < 3U; ++axis) {
    const Vec3 below = with_component(g.origin, axis, std::nextafter(component(g.origin, axis), -kInf));
    const Vec3 above = with_component(g.domain_maximum, axis,
                                      std::nextafter(component(g.domain_maximum, axis), kInf));
    for (const Vec3& query : {below, above}) {
      const auto sample = field.evaluate_with_gradient("C_H", query);
      require(sample.status == ScoringFieldStatus::OutOfDomain &&
                  sample.diagnostic_code == "SCORING_FIELD_OUT_OF_DOMAIN" && !sample.gradient_valid &&
                  sample.inter_score == 0.0,
              "one ulp outside the field is INVALID SCORING_FIELD_OUT_OF_DOMAIN, never clamped");
    }
  }
  const Vec3 far{g.domain_maximum.x + 100.0, 0.0, 0.0};
  require(field.evaluate_with_gradient("C_H", far).diagnostic_code == "SCORING_FIELD_OUT_OF_DOMAIN",
          "far outside the field is out of domain (no extrapolation)");
  const double nan = std::numeric_limits<double>::quiet_NaN();
  for (const Vec3& bad : {Vec3{nan, 0.0, 0.0}, Vec3{0.0, kInf, 0.0}, Vec3{0.0, 0.0, -kInf}}) {
    const auto sample = field.evaluate_with_gradient("C_H", bad);
    require(sample.status == ScoringFieldStatus::NonFinite &&
                sample.diagnostic_code == "SEARCH_OBJECTIVE_NONFINITE" && !sample.gradient_valid,
            "non-finite query aborts with SEARCH_OBJECTIVE_NONFINITE");
  }
  require(field.evaluate_with_gradient("B", face).diagnostic_code == "SCORING_FIELD_CHANNEL_MISSING",
          "unknown XS type has no channel");
}

void test_admissibility_edges() {
  const AxisAlignedBox box = kRegion;
  const auto admissible = [&box](std::vector<Vec3> points) {
    return search_region_admissible(std::span<const Vec3>(points), box);
  };
  require(admissible({box.maximum}).status == SearchRegionAdmissibility::Admissible,
          "heavy atom exactly at the maximum corner is admissible");
  require(admissible({box.minimum}).status == SearchRegionAdmissibility::Admissible,
          "heavy atom exactly at the minimum corner is admissible");
  require(admissible({Vec3{box.maximum.x, 0.0, 0.0}, Vec3{0.0, box.minimum.y, box.maximum.z}}).status ==
              SearchRegionAdmissibility::Admissible,
          "heavy atoms on faces are admissible");
  for (std::size_t axis = 0; axis < 3U; ++axis) {
    const Vec3 center{0.0, 0.0, 0.0};
    const Vec3 above = with_component(center, axis, std::nextafter(component(box.maximum, axis), kInf));
    const Vec3 below = with_component(center, axis, std::nextafter(component(box.minimum, axis), -kInf));
    for (const Vec3& outside : {above, below}) {
      const auto check = admissible({center, outside});
      require(check.status == SearchRegionAdmissibility::OutsideRegion &&
                  check.diagnostic_code == "SEARCH_POSE_OUTSIDE_REGION" && check.first_violation_index == 1U,
              "one ulp outside a face is inadmissible (no epsilon)");
    }
  }
  const AxisAlignedBox zero_face{Vec3{0.0, 0.0, 0.0}, Vec3{1.0, 1.0, 1.0}};
  const std::vector<Vec3> negative_zero{Vec3{-0.0, -0.0, -0.0}};
  require(search_region_admissible(std::span<const Vec3>(negative_zero), zero_face).status ==
              SearchRegionAdmissibility::Admissible,
          "-0 on a +0 face is on the face");
  const double nan = std::numeric_limits<double>::quiet_NaN();
  require(admissible({Vec3{0.0, nan, 0.0}}).status == SearchRegionAdmissibility::NonFinite &&
              admissible({Vec3{kInf, 0.0, 0.0}}).diagnostic_code == "SEARCH_OBJECTIVE_NONFINITE",
          "non-finite heavy atom aborts with SEARCH_OBJECTIVE_NONFINITE");
  require(admissible({}).status == SearchRegionAdmissibility::NoHeavyAtoms, "empty pose is not admissible");
  const AxisAlignedBox inverted{Vec3{1.0, 0.0, 0.0}, Vec3{0.0, 1.0, 1.0}};
  const std::vector<Vec3> origin_only{Vec3{}};
  require(search_region_admissible(std::span<const Vec3>(origin_only), inverted).status ==
              SearchRegionAdmissibility::InvalidRegion,
          "inverted region is invalid");
  // Hydrogens are ignored by the rule; heavy atoms are not.
  const std::vector<Atom> with_h{atom("a", "C_H", Vec3{0.0, 0.0, 0.0}), hydrogen("h", Vec3{9.0, 9.0, 9.0})};
  require(search_region_admissible(std::span<const Atom>(with_h), box).status ==
              SearchRegionAdmissibility::Admissible,
          "a hydrogen outside the region does not make the pose inadmissible");
  const std::vector<Atom> heavy_out{atom("a", "C_H", Vec3{0.0, 0.0, 0.0}),
                                    atom("b", "O_A", Vec3{std::nextafter(box.maximum.x, kInf), 0.0, 0.0})};
  require(search_region_admissible(std::span<const Atom>(heavy_out), box).status ==
              SearchRegionAdmissibility::OutsideRegion,
          "a heavy atom one ulp outside makes the pose inadmissible");
}

void test_admissible_implies_in_domain(const Fixture& fixture) {
  const ScoringField& field = *fixture.field;
  const AxisAlignedBox& region = field.geometry().search_region;
  SplitMix64 rng(0x4D384BULL);
  for (std::size_t i = 0; i < kRandomPoints; ++i) {
    double c[3]{};
    const double lo[3]{region.minimum.x, region.minimum.y, region.minimum.z};
    const double hi[3]{region.maximum.x, region.maximum.y, region.maximum.z};
    for (std::size_t axis = 0; axis < 3U; ++axis) {
      const std::size_t mode = rng.below(8U);  // Snap some coordinates exactly onto faces.
      c[axis] = mode == 0U ? lo[axis] : mode == 1U ? hi[axis] : lo[axis] + (hi[axis] - lo[axis]) * rng.unit();
    }
    const std::vector<Vec3> pose{Vec3{c[0], c[1], c[2]}};
    require(search_region_admissible(std::span<const Vec3>(pose), region).status ==
                SearchRegionAdmissibility::Admissible,
            "sampled point is admissible");
    const auto sample = field.evaluate_with_gradient(kLigandTypes[i % kLigandTypes.size()], pose[0]);
    require(sample.status == ScoringFieldStatus::Valid,
            "invariant: every admissible heavy atom has a complete stencil in the field domain");
  }
}

std::vector<Atom> ligand_pose(Vec3 shift) {
  std::vector<Atom> atoms{atom("L3", "O_A", Vec3{0.9, -0.2, 0.3}), atom("L1", "C_H", Vec3{-0.4, 0.1, -0.2}),
                          hydrogen("L4", Vec3{-0.4, 1.1, -0.2}), atom("L2", "N_DA", Vec3{0.3, 0.7, 0.1})};
  for (Atom& a : atoms) a.position = Vec3{a.position.x + shift.x, a.position.y + shift.y, a.position.z + shift.z};
  return atoms;
}

IntraNonbondedTerm intra_for(const std::vector<Atom>& atoms, double energy) {
  IntraNonbondedTerm intra;
  intra.energy = energy;
  for (std::size_t i = 0; i < atoms.size(); ++i) {
    intra.atom_gradient.push_back(Vec3{0.01 * static_cast<double>(i), -0.02, 0.005});
  }
  return intra;
}

void test_search_objective(const Fixture& fixture) {
  const ScoringField& field = *fixture.field;
  const auto atoms = ligand_pose(Vec3{0.1, 0.0, 0.0});
  const auto intra = intra_for(atoms, -0.375);
  const auto eval = evaluate_search_objective(field, atoms, intra);
  require(eval.status == SearchObjectiveStatus::Valid && eval.field_queried && eval.gradient_valid,
          "admissible pose has a valid search objective");
  require(eval.e_search == eval.e_inter + eval.e_intra && eval.e_intra == intra.energy,
          "E_search is exactly E_inter + E_intra_nonbonded (no box term)");
  double weighted_check = 0.0;
  for (std::size_t term = 0; term < kTermCount; ++term) {
    require(eval.inter_weighted[term] == eval.inter_raw[term] * kScoringTermCoefficients[term],
            "objective weights are applied after summing interpolated raw terms");
    weighted_check += eval.inter_weighted[term];
  }
  require(std::abs(weighted_check - eval.e_inter) <= 1e-12, "E_inter is the weighted term total");
  for (std::size_t i = 0; i < atoms.size(); ++i) {
    Vec3 expected = intra.atom_gradient[i];
    if (atoms[i].element != "H") {
      const auto sample = field.evaluate_with_gradient(atoms[i].xs_type, atoms[i].position);
      expected = Vec3{sample.inter_gradient.x + expected.x, sample.inter_gradient.y + expected.y,
                      sample.inter_gradient.z + expected.z};
    }
    require(eval.atom_gradient[i].x == expected.x && eval.atom_gradient[i].y == expected.y &&
                eval.atom_gradient[i].z == expected.z,
            "per-atom gradient is field gradient plus intra gradient (hydrogens: intra only)");
  }
  // Input order cannot change the bits.
  auto reversed = atoms;
  std::reverse(reversed.begin(), reversed.end());
  auto reversed_intra = intra;
  std::reverse(reversed_intra.atom_gradient.begin(), reversed_intra.atom_gradient.end());
  const auto eval_reversed = evaluate_search_objective(field, reversed, reversed_intra);
  require(eval_reversed.e_search == eval.e_search && eval_reversed.e_inter == eval.e_inter,
          "objective is order-independent (stable AtomUID summation)");

  // Pose exactly on a face: admissible and scored with no extra term.
  auto on_face = atoms;
  on_face[0].position.x = kRegion.maximum.x;
  const auto face_eval = evaluate_search_objective(field, on_face, intra);
  require(face_eval.status == SearchObjectiveStatus::Valid, "heavy atom on a face is scored");
  // One ulp outside the SearchRegion but deep inside the field halo: rejected
  // unscored with SEARCH_POSE_OUTSIDE_REGION, distinct from OUT_OF_DOMAIN.
  auto outside = atoms;
  outside[0].position.x = std::nextafter(kRegion.maximum.x, kInf);
  require(field.evaluate_with_gradient(outside[0].xs_type, outside[0].position).status ==
              ScoringFieldStatus::Valid,
          "fixture: the outside atom is still inside the scoring-field domain");
  const auto outside_eval = evaluate_search_objective(field, outside, intra);
  require(outside_eval.status == SearchObjectiveStatus::Inadmissible &&
              outside_eval.diagnostic_code == "SEARCH_POSE_OUTSIDE_REGION" && !outside_eval.field_queried &&
              outside_eval.e_search == 0.0 && !outside_eval.gradient_valid,
          "out-of-box pose is rejected unscored, never penalised");
  require(outside_eval.diagnostic_code != "SCORING_FIELD_OUT_OF_DOMAIN",
          "box inadmissibility is distinct from field out-of-domain");
  // A hydrogen outside the box does not affect admissibility or the score.
  auto h_out = atoms;
  h_out[2].position = Vec3{50.0, 50.0, 50.0};
  const auto h_eval = evaluate_search_objective(field, h_out, intra);
  require(h_eval.status == SearchObjectiveStatus::Valid && h_eval.e_inter == eval.e_inter,
          "hydrogens are ignored by admissibility and inter scoring");
  // Non-finite inputs abort.
  auto nan_pose = atoms;
  nan_pose[2].position.y = std::numeric_limits<double>::quiet_NaN();
  require(evaluate_search_objective(field, nan_pose, intra).diagnostic_code == "SEARCH_OBJECTIVE_NONFINITE",
          "NaN coordinate aborts the objective");
  auto bad_intra = intra;
  bad_intra.energy = std::numeric_limits<double>::quiet_NaN();
  require(evaluate_search_objective(field, atoms, bad_intra).diagnostic_code == "SEARCH_OBJECTIVE_NONFINITE",
          "NaN intra energy aborts the objective");
  auto invalid_grad = intra;
  invalid_grad.gradient_valid = false;
  const auto invalid_eval = evaluate_search_objective(field, atoms, invalid_grad);
  require(invalid_eval.status == SearchObjectiveStatus::Valid && !invalid_eval.gradient_valid &&
              invalid_eval.gradient_diagnostic_code == "INVALID_GRADIENT" && std::isfinite(invalid_eval.e_search),
          "an invalid intra gradient keeps a finite score with gradient_valid = false");
}

void test_line_search_hook(const Fixture& fixture) {
  const auto always_in = [](double) { return SearchRegionCheck{SearchRegionAdmissibility::Admissible, {}, 0U}; };
  const auto out = SearchRegionCheck{SearchRegionAdmissibility::OutsideRegion, kSearchPoseOutsideRegionCode, 0U};
  // Quadratic E(a) = (a - 0.25)^2 along the direction from E(0) = 0.0625, slope -0.5.
  int scored = 0;
  const auto quadratic = [&scored](double a) {
    ++scored;
    return LineSearchScoredTrial{true, (a - 0.25) * (a - 0.25), {}};
  };
  auto r = backtracking_line_search(0.0625, -0.5, always_in, quadratic);
  require(r.status == LineSearchStatus::Accepted && r.alpha == 0.25 && r.trials == 3U && r.scored_trials == 3U,
          "Armijo backtracking accepts the first sufficient-decrease step");

  // Trials with alpha > 1/8 leave the box: halved without scoring.
  scored = 0;
  const auto small_only = [&out](double a) {
    return a > 0.125 ? out : SearchRegionCheck{SearchRegionAdmissibility::Admissible, {}, 0U};
  };
  r = backtracking_line_search(0.0625, -0.5, small_only, quadratic);
  require(r.status == LineSearchStatus::Accepted && r.alpha == 0.125 && r.inadmissible_trials == 3U &&
              scored == 1 && r.scored_trials == 1U,
          "out-of-box trials halve alpha and are never scored");

  // Ten out-of-box trials -> BOUNDARY_BLOCKED, scorer never called.
  scored = 0;
  const auto never_in = [&out](double) { return out; };
  r = backtracking_line_search(0.0625, -0.5, never_in, quadratic);
  require(r.status == LineSearchStatus::BoundaryBlocked && r.diagnostic_code == "BOUNDARY_BLOCKED" &&
              r.trials == 10U && r.inadmissible_trials == 10U && scored == 0 && r.alpha == 0x1.0p-9,
          "10 out-of-box trials return BOUNDARY_BLOCKED");

  // Feasible but never sufficient decrease -> LINE_SEARCH_FAILED.
  const auto uphill = [](double a) { return LineSearchScoredTrial{true, 1.0 + a, {}}; };
  r = backtracking_line_search(0.0, -1.0, always_in, uphill);
  require(r.status == LineSearchStatus::LineSearchFailed && r.diagnostic_code == "LINE_SEARCH_FAILED" &&
              r.trials == 10U,
          "feasible trials without Armijo decrease return LINE_SEARCH_FAILED");
  // Mixed: some out-of-box, rest fail Armijo -> LINE_SEARCH_FAILED, not BOUNDARY_BLOCKED.
  r = backtracking_line_search(0.0, -1.0, small_only, uphill);
  require(r.status == LineSearchStatus::LineSearchFailed, "mixed trials are LINE_SEARCH_FAILED");
  // Non-finite trial energy or NaN trial pose aborts.
  const auto nan_energy = [](double) {
    return LineSearchScoredTrial{true, std::numeric_limits<double>::quiet_NaN(), {}};
  };
  r = backtracking_line_search(0.0, -1.0, always_in, nan_energy);
  require(r.status == LineSearchStatus::Aborted && r.diagnostic_code == "SEARCH_OBJECTIVE_NONFINITE",
          "non-finite trial energy aborts");
  const auto nan_pose = [](double) {
    return SearchRegionCheck{SearchRegionAdmissibility::NonFinite, kSearchObjectiveNonfiniteCode, 0U};
  };
  r = backtracking_line_search(0.0, -1.0, nan_pose, quadratic);
  require(r.status == LineSearchStatus::Aborted && r.diagnostic_code == "SEARCH_OBJECTIVE_NONFINITE",
          "non-finite trial pose aborts");
  r = backtracking_line_search(0.0, 1.0, always_in, quadratic);
  require(r.status == LineSearchStatus::Aborted, "non-descent direction is rejected");

  // Integration: real pose pushed outward along +x from near the face.
  const ScoringField& field = *fixture.field;
  const auto start = ligand_pose(Vec3{0.6, 0.0, 0.0});
  const auto intra = intra_for(start, 0.0);
  const auto e0 = evaluate_search_objective(field, start, intra);
  require(e0.status == SearchObjectiveStatus::Valid, "integration start pose is valid");
  const Vec3 direction{3.0, 0.0, 0.0};
  const auto moved = [&start, &direction](double a) {
    auto atoms = start;
    for (Atom& atom : atoms) atom.position.x += a * direction.x;
    return atoms;
  };
  int field_calls = 0;
  const auto region_fn = [&](double a) {
    const auto atoms = moved(a);
    return search_region_admissible(std::span<const Atom>(atoms), field.geometry().search_region);
  };
  const auto score_fn = [&](double a) {
    ++field_calls;
    const auto atoms = moved(a);
    const auto e = evaluate_search_objective(field, atoms, intra);
    require(e.status == SearchObjectiveStatus::Valid, "line search only scores admissible poses");
    return LineSearchScoredTrial{true, e.e_search, {}};
  };
  // Use a descent slope large enough that any admissible decrease is accepted
  // or rejected purely by Armijo; the check here is boundary handling.
  r = backtracking_line_search(e0.e_search, -1.0e-12, region_fn, score_fn);
  require(r.inadmissible_trials >= 1U && static_cast<std::size_t>(field_calls) == r.scored_trials,
          "integration: out-of-box trials are halved before any field call");
  const auto final_atoms = moved(r.alpha);
  require(r.status != LineSearchStatus::Accepted ||
              search_region_admissible(std::span<const Atom>(final_atoms), field.geometry().search_region)
                      .status == SearchRegionAdmissibility::Admissible,
          "an accepted step is always admissible");
}

void test_direct_zero_distance_gradient() {
  Request request;
  request.receptor_state_digest = "sha256:" + std::string(64, '1');
  request.ligand_state_digest = "sha256:" + std::string(64, '2');
  request.coordinate_state_digest = "sha256:" + std::string(64, '3');
  request.search_region_digest = "sha256:" + std::string(64, '4');
  request.scoring_profile_digest = "sha256:" + std::string(64, '5');
  request.typing_profile_digest = "sha256:" + std::string(64, '6');
  request.chemistry_profile_digest = "sha256:" + std::string(64, '7');
  request.numerical_backend_profile_digest = "sha256:" + std::string(64, '8');
  request.receptor_typing_assignment_digest = "sha256:" + std::string(64, '9');
  request.ligand_typing_assignment_digest = "sha256:" + std::string(64, 'a');
  request.receptor_profile_id = std::string(kReceptorProfileId);
  request.scoring_profile_id = std::string(kScoringProfileId);
  request.receptor_typing_profile_id = std::string(kTypingProfileId);
  request.ligand_typing_profile_id = std::string(kTypingProfileId);
  request.chemistry_profile_id = std::string(kChemistryProfileId);
  request.numerical_backend_profile_id = std::string(kBackendProfileId);
  request.site_class = SiteClass::DryCore;
  request.coordinate_units = "ANGSTROM";
  request.scorer_torsion_assignment = {std::string(kD3VinaTorsionProfileId),
                                       std::string(kD3VinaTorsionProfileDigest),
                                       "sha256:" + std::string(64, 'b'), 0.0};
  request.receptor_atoms = {atom("r1", "C_H", Vec3{0.0, 0.0, 0.0})};
  request.ligand_atoms = {atom("l1", "C_H", Vec3{3.8, 0.0, 0.0})};
  const auto ordinary = score_direct(request);
  require(ordinary.valid && ordinary.gradient_valid && ordinary.gradient_diagnostic_code.empty(),
          "r > 0 has a valid gradient");
  request.ligand_atoms[0].position = Vec3{0.0, 0.0, 0.0};
  const auto zero = score_direct(request);
  require(zero.valid && std::isfinite(zero.decomposition.inter_score) && !zero.gradient_valid &&
              zero.gradient_diagnostic_code == "INVALID_GRADIENT",
          "r = 0: finite score, gradient flagged INVALID_GRADIENT (never zeroed or perturbed)");
  request.ligand_atoms[0].position.z = std::numeric_limits<double>::quiet_NaN();
  require(!score_direct(request).valid, "NaN coordinate aborts direct scoring");
}

}  // namespace

int main() {
  const Fixture fixture = make_fixture();
  test_finite_difference_sanity(fixture);
  test_grid_vs_scalar_reference(fixture);
  test_grid_nodes_vs_direct(fixture);
  test_face_and_corner_cell_rule(fixture);
  test_admissibility_edges();
  test_admissible_implies_in_domain(fixture);
  test_search_objective(fixture);
  test_line_search_hook(fixture);
  test_direct_zero_distance_gradient();
  std::cout << "PASS: gradient/admissibility fixtures (9 groups, " << g_checks << " checks)\n";
  return 0;
}
