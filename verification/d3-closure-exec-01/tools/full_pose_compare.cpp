#include "mole/docking/scoring_field.hpp"

#include <algorithm>
#include <array>
#include <bit>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <map>
#include <optional>
#include <sstream>
#include <string>
#include <string_view>
#include <vector>

namespace {

using namespace mole::docking;

struct Pose final {
  std::string id;
  std::string cohort;
  bool cutoff_stress{};
  Vec3 translation;
  Vec3 axis;
  double angle{};
  Vec3 origin;
};

struct Input final {
  std::map<std::string, std::string> meta;
  AxisAlignedBox region;
  std::vector<Atom> receptor;
  std::vector<Atom> ligand;
  std::vector<Pose> poses;
};

[[noreturn]] void fail(const std::string& message) {
  std::cerr << "full_pose_compare: " << message << '\n';
  std::exit(2);
}

std::vector<std::string> split_tabs(const std::string& line) {
  std::vector<std::string> fields;
  std::size_t start = 0;
  while (true) {
    const auto end = line.find('\t', start);
    fields.emplace_back(line.substr(start, end == std::string::npos ? end : end - start));
    if (end == std::string::npos) break;
    start = end + 1U;
  }
  return fields;
}

double parse_double(const std::string& text) {
  char* end = nullptr;
  const double value = std::strtod(text.c_str(), &end);
  if (end == text.c_str() || *end != '\0' || !std::isfinite(value)) fail("invalid finite float");
  return value;
}

std::size_t parse_size(const std::string& text) {
  std::size_t consumed = 0U;
  const auto value = std::stoull(text, &consumed);
  if (consumed != text.size()) fail("invalid integer");
  return static_cast<std::size_t>(value);
}

bool parse_bool(const std::string& text) {
  if (text == "1") return true;
  if (text == "0") return false;
  fail("invalid boolean");
}

std::optional<int> parse_optional_int(const std::string& text) {
  if (text == "null") return std::nullopt;
  std::size_t consumed = 0U;
  const int value = std::stoi(text, &consumed);
  if (consumed != text.size()) fail("invalid optional integer");
  return value;
}

std::optional<double> parse_optional_double(const std::string& text) {
  if (text == "null") return std::nullopt;
  return parse_double(text);
}

bool sha256(std::string_view value) {
  if (value.size() != 71U || value.substr(0U, 7U) != "sha256:") return false;
  return std::all_of(value.begin() + 7, value.end(), [](char c) {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
  });
}

Atom parse_atom(const std::vector<std::string>& f) {
  if (f.size() != 11U) fail("malformed atom record");
  return Atom{f[2], f[3], Vec3{parse_double(f[8]), parse_double(f[9]), parse_double(f[10])},
              parse_optional_int(f[5]), parse_optional_double(f[6]), f[4], parse_bool(f[7])};
}

Input read_input() {
  Input input;
  std::string line;
  bool header = false;
  bool ended = false;
  while (std::getline(std::cin, line)) {
    if (line.empty()) continue;
    const auto f = split_tabs(line);
    if (!header) {
      if (f.size() != 2U || f[0] != "SCHEMA" || f[1] != "MOLE_D3_FULLPOSE_NATIVE_V1") fail("unsupported TSV schema");
      header = true;
      continue;
    }
    if (f[0] == "END") { ended = true; break; }
    if (f[0] == "META" && f.size() == 3U) {
      if (!input.meta.emplace(f[1], f[2]).second) fail("duplicate metadata key");
    } else if (f[0] == "REGION" && f.size() == 7U) {
      input.region = {Vec3{parse_double(f[1]), parse_double(f[2]), parse_double(f[3])},
                      Vec3{parse_double(f[4]), parse_double(f[5]), parse_double(f[6])}};
    } else if (f[0] == "ATOM") {
      auto atom = parse_atom(f);
      if (f[1] == "RECEPTOR") input.receptor.push_back(std::move(atom));
      else if (f[1] == "LIGAND") input.ligand.push_back(std::move(atom));
      else fail("unknown atom collection");
    } else if (f[0] == "POSE" && f.size() == 15U) {
      input.poses.push_back(Pose{f[1], f[2], parse_bool(f[3]),
          Vec3{parse_double(f[4]), parse_double(f[5]), parse_double(f[6])},
          Vec3{parse_double(f[7]), parse_double(f[8]), parse_double(f[9])}, parse_double(f[10]),
          Vec3{parse_double(f[11]), parse_double(f[12]), parse_double(f[13])}});
      if (f[14] != "POSE_V1") fail("invalid pose record terminator");
    } else {
      fail("malformed input record");
    }
  }
  if (!header || !ended || input.receptor.empty() || input.ligand.empty() || input.poses.empty()) fail("incomplete input");
  return input;
}

std::string require_meta(const Input& input, const std::string& key) {
  const auto found = input.meta.find(key);
  if (found == input.meta.end()) fail("missing metadata: " + key);
  return found->second;
}

SiteClass site_class(const std::string& value) {
  if (value == "DRY_CORE") return SiteClass::DryCore;
  if (value == "FIXED_WATER") return SiteClass::FixedWater;
  if (value == "MOBILE_WATER") return SiteClass::MobileWater;
  if (value == "ION") return SiteClass::Ion;
  if (value == "METAL") return SiteClass::Metal;
  if (value == "COFACTOR") return SiteClass::Cofactor;
  if (value == "WATER_DEPENDENT") return SiteClass::WaterDependent;
  fail("unknown site class");
}

Vec3 transform(Vec3 point, const Pose& pose) {
  const double axis_norm = std::hypot(std::hypot(pose.axis.x, pose.axis.y), pose.axis.z);
  if (!(axis_norm > 0.0)) fail("rotation axis must be nonzero");
  const Vec3 u{pose.axis.x / axis_norm, pose.axis.y / axis_norm, pose.axis.z / axis_norm};
  const double x = point.x - pose.origin.x;
  const double y = point.y - pose.origin.y;
  const double z = point.z - pose.origin.z;
  const double c = std::cos(pose.angle);
  const double s = std::sin(pose.angle);
  const double dot = u.x * x + u.y * y + u.z * z;
  const Vec3 cross{u.y * z - u.z * y, u.z * x - u.x * z, u.x * y - u.y * x};
  return Vec3{pose.origin.x + x * c + cross.x * s + u.x * dot * (1.0 - c) + pose.translation.x,
              pose.origin.y + y * c + cross.y * s + u.y * dot * (1.0 - c) + pose.translation.y,
              pose.origin.z + z * c + cross.z * s + u.z * dot * (1.0 - c) + pose.translation.z};
}

std::string bits(double value) {
  std::ostringstream out;
  out << std::hex << std::setfill('0') << std::setw(16) << std::bit_cast<std::uint64_t>(value);
  return out.str();
}

void emit_double(double value) { std::cout << '\t' << std::setprecision(17) << value; }

void validate_request_digests(const Request& request) {
  const std::array<std::string_view, 11> digests{
      request.receptor_state_digest, request.ligand_state_digest, request.coordinate_state_digest,
      request.search_region_digest, request.scoring_profile_digest, request.typing_profile_digest,
      request.chemistry_profile_digest, request.numerical_backend_profile_digest,
      request.receptor_typing_assignment_digest, request.ligand_typing_assignment_digest,
      request.scorer_torsion_assignment.assignment_digest};
  if (!std::all_of(digests.begin(), digests.end(), sha256)) fail("invalid SHA-256 metadata");
}

void run() {
  Input input = read_input();
  Request base;
  base.receptor_state_digest = require_meta(input, "receptor_state_digest");
  base.ligand_state_digest = require_meta(input, "ligand_state_digest");
  base.coordinate_state_digest = require_meta(input, "coordinate_state_digest");
  base.search_region_digest = require_meta(input, "search_region_digest");
  base.receptor_profile_id = require_meta(input, "receptor_profile_id");
  base.scoring_profile_id = require_meta(input, "scoring_profile_id");
  base.scoring_profile_digest = require_meta(input, "scoring_profile_digest");
  base.receptor_typing_profile_id = require_meta(input, "receptor_typing_profile_id");
  base.ligand_typing_profile_id = require_meta(input, "ligand_typing_profile_id");
  base.typing_profile_digest = require_meta(input, "typing_profile_digest");
  base.receptor_typing_assignment_digest = require_meta(input, "receptor_typing_assignment_digest");
  base.ligand_typing_assignment_digest = require_meta(input, "ligand_typing_assignment_digest");
  base.chemistry_profile_id = require_meta(input, "chemistry_profile_id");
  base.chemistry_profile_digest = require_meta(input, "chemistry_profile_digest");
  base.numerical_backend_profile_id = require_meta(input, "numerical_backend_profile_id");
  base.numerical_backend_profile_digest = require_meta(input, "numerical_backend_profile_digest");
  base.coordinate_units = require_meta(input, "coordinate_units");
  base.site_class = site_class(require_meta(input, "site_class"));
  base.search_torsion_count = parse_size(require_meta(input, "search_torsion_count"));
  base.scorer_torsion_assignment = {
      require_meta(input, "scorer_torsion_profile_id"), require_meta(input, "scorer_torsion_profile_digest"),
      require_meta(input, "scorer_torsion_assignment_digest"), parse_double(require_meta(input, "n_tors_vina"))};
  base.receptor_atoms = input.receptor;
  base.ligand_atoms = input.ligand;
  validate_request_digests(base);

  ScoringFieldBuildRequest field_request;
  field_request.dependencies.receptor_state_digest = base.receptor_state_digest;
  field_request.dependencies.receptor_typing_assignment_digest = base.receptor_typing_assignment_digest;
  field_request.dependencies.search_region_digest = base.search_region_digest;
  field_request.dependencies.receptor_profile_id = base.receptor_profile_id;
  field_request.dependencies.scoring_profile_id = base.scoring_profile_id;
  field_request.dependencies.scoring_profile_digest = base.scoring_profile_digest;
  field_request.dependencies.typing_profile_id = base.receptor_typing_profile_id;
  field_request.dependencies.typing_profile_digest = base.typing_profile_digest;
  field_request.dependencies.chemistry_profile_id = base.chemistry_profile_id;
  field_request.dependencies.chemistry_profile_digest = base.chemistry_profile_digest;
  field_request.dependencies.numerical_backend_profile_id = base.numerical_backend_profile_id;
  field_request.dependencies.numerical_backend_profile_digest = base.numerical_backend_profile_digest;
  field_request.search_region = input.region;
  field_request.receptor_atoms = input.receptor;
  field_request.site_class = base.site_class;
  field_request.coordinate_units = base.coordinate_units;
  field_request.site_influence_complete = parse_bool(require_meta(input, "site_influence_complete"));
  const auto built = build_scoring_field(field_request);
  if (!built.valid || !built.field) fail("field build failed: " + built.diagnostic_code + ": " + built.diagnostic);
  const auto& field = *built.field;
  const auto& field_deps = field.dependencies();
  if (field_deps.receptor_state_digest != base.receptor_state_digest ||
      field_deps.receptor_typing_assignment_digest != base.receptor_typing_assignment_digest ||
      field_deps.search_region_digest != base.search_region_digest ||
      field_deps.scoring_profile_id != base.scoring_profile_id ||
      field_deps.scoring_profile_digest != base.scoring_profile_digest ||
      field_deps.typing_profile_id != base.receptor_typing_profile_id ||
      field_deps.typing_profile_digest != base.typing_profile_digest ||
      field_deps.chemistry_profile_id != base.chemistry_profile_id ||
      field_deps.chemistry_profile_digest != base.chemistry_profile_digest ||
      field_deps.numerical_backend_profile_id != base.numerical_backend_profile_id ||
      field_deps.numerical_backend_profile_digest != base.numerical_backend_profile_digest) {
    fail("scoring-field dependency tuple does not match the direct request");
  }
  if (!sha256(field.logical_digest())) fail("invalid scoring-field digest");
  std::cout << "FIELD\t" << field.logical_digest() << '\n';

  std::sort(base.ligand_atoms.begin(), base.ligand_atoms.end(), [](const Atom& a, const Atom& b) { return a.atom_uid < b.atom_uid; });
  for (const auto& pose : input.poses) {
    Request request = base;
    for (auto& atom : request.ligand_atoms) atom.position = transform(atom.position, pose);
    for (const auto& atom : request.ligand_atoms) {
      if (atom.position.x < input.region.minimum.x || atom.position.x > input.region.maximum.x ||
          atom.position.y < input.region.minimum.y || atom.position.y > input.region.maximum.y ||
          atom.position.z < input.region.minimum.z || atom.position.z > input.region.maximum.z) {
        fail("pose violates the sealed closed SearchRegion: " + pose.id);
      }
    }
    const auto direct = score_direct(request);
    if (!direct.valid) fail("direct score failed for " + pose.id + ": " + direct.diagnostic_code + ": " + direct.diagnostic);
    if (direct.receptor_state_digest != request.receptor_state_digest ||
        direct.ligand_state_digest != request.ligand_state_digest ||
        direct.coordinate_state_digest != request.coordinate_state_digest ||
        direct.search_region_digest != request.search_region_digest ||
        direct.scoring_profile_digest != request.scoring_profile_digest ||
        direct.typing_profile_digest != request.typing_profile_digest ||
        direct.chemistry_profile_digest != request.chemistry_profile_digest ||
        direct.numerical_backend_profile_digest != request.numerical_backend_profile_digest ||
        direct.receptor_typing_assignment_digest != request.receptor_typing_assignment_digest ||
        direct.ligand_typing_assignment_digest != request.ligand_typing_assignment_digest ||
        direct.scorer_torsion_profile_id != request.scorer_torsion_assignment.profile_id ||
        direct.scorer_torsion_profile_digest != request.scorer_torsion_assignment.profile_digest ||
        direct.scorer_torsion_assignment_digest != request.scorer_torsion_assignment.assignment_digest ||
        direct.n_tors_vina != request.scorer_torsion_assignment.n_tors_vina) {
      fail("direct result digest/profile tuple mismatch for " + pose.id);
    }
    RawTerms grid_raw{};
    for (const auto& atom : request.ligand_atoms) {
      const auto sample = field.interpolate(atom.xs_type, atom.position);
      if (sample.status != ScoringFieldStatus::Valid) {
        const char* status = sample.status == ScoringFieldStatus::OutOfDomain ? "OUT_OF_DOMAIN" :
            sample.status == ScoringFieldStatus::ChannelMissing ? "CHANNEL_MISSING" : "INVALID_FIELD";
        fail("grid interpolation failed closed for " + pose.id + ": " + status);
      }
      for (std::size_t term = 0; term < kTermCount; ++term) grid_raw[term] += sample.raw[term];
      std::cout << "POSE_ATOM\t" << pose.id << '\t' << atom.atom_uid << '\t'
                << bits(atom.position.x) << '\t' << bits(atom.position.y) << '\t' << bits(atom.position.z) << '\n';
    }
    RawTerms grid_weighted{};
    double grid_inter = 0.0;
    for (std::size_t term = 0; term < kTermCount; ++term) {
      grid_weighted[term] = grid_raw[term] * kScoringTermCoefficients[term];
      grid_inter += grid_weighted[term];
    }
    std::cout << "RESULT\t" << pose.id << '\t' << pose.cohort << '\t' << (pose.cutoff_stress ? 1 : 0);
    for (double v : direct.decomposition.raw) emit_double(v);
    for (double v : grid_raw) emit_double(v);
    for (double v : direct.decomposition.weighted) emit_double(v);
    for (double v : grid_weighted) emit_double(v);
    emit_double(direct.decomposition.inter_score);
    emit_double(grid_inter);
    emit_double(grid_inter - direct.decomposition.inter_score);
    emit_double(direct.n_tors_vina);
    emit_double(direct.decomposition.torsion_divisor);
    emit_double(direct.decomposition.empirical_score);
    std::cout << '\t' << field.logical_digest() << "\tIN_DOMAIN\n";
  }
}

}  // namespace

int main() {
  try {
    run();
  } catch (const std::exception& error) {
    fail(error.what());
  }
  return 0;
}
