#include "mole/docking/scoring.hpp"

#include <array>
#include <bit>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace {

using mole::docking::Atom;
using mole::docking::Request;
using mole::docking::SiteClass;
using mole::docking::Vec3;

struct Type final {
  std::string_view id;
  std::string_view element;
  double radius;
  bool hydrophobic;
  bool donor;
  bool acceptor;
};

constexpr std::array<Type, 16> kTypes{{
    {"C_H", "C", 1.9, true, false, false},
    {"C_P", "C", 1.9, false, false, false},
    {"N_P", "N", 1.8, false, false, false},
    {"N_D", "N", 1.8, false, true, false},
    {"N_A", "N", 1.8, false, false, true},
    {"N_DA", "N", 1.8, false, true, true},
    {"O_P", "O", 1.7, false, false, false},
    {"O_D", "O", 1.7, false, true, false},
    {"O_A", "O", 1.7, false, false, true},
    {"O_DA", "O", 1.7, false, true, true},
    {"S_P", "S", 2.0, false, false, false},
    {"P_P", "P", 2.1, false, false, false},
    {"F_H", "F", 1.5, true, false, false},
    {"Cl_H", "Cl", 1.8, true, false, false},
    {"Br_H", "Br", 2.0, true, false, false},
    {"I_H", "I", 2.2, true, false, false},
}};

constexpr std::array<double, 5> kSurfaceDistances{-0.5, 0.25, 0.75, 1.25, 1.75};
void require(bool condition, const std::string& message) {
  if (!condition) throw std::runtime_error(message);
}

std::uint64_t bits(double value) {
  return std::bit_cast<std::uint64_t>(value);
}

std::string hex_bits(std::uint64_t value) {
  constexpr char digits[] = "0123456789abcdef";
  std::string result(16, '0');
  for (int index = 15; index >= 0; --index) {
    result[static_cast<std::size_t>(index)] = digits[value & 0xfU];
    value >>= 4U;
  }
  return result;
}

Atom make_atom(std::string uid, const Type& type, Vec3 position) {
  return Atom{std::move(uid), std::string(type.id), position, 0, std::nullopt,
              std::string(type.element), true};
}

Request base_request(const Type& receptor, const Type& ligand, double distance) {
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
  request.receptor_profile_id = std::string(mole::docking::kReceptorProfileId);
  request.scoring_profile_id = std::string(mole::docking::kScoringProfileId);
  request.receptor_typing_profile_id = std::string(mole::docking::kTypingProfileId);
  request.ligand_typing_profile_id = std::string(mole::docking::kTypingProfileId);
  request.chemistry_profile_id = std::string(mole::docking::kChemistryProfileId);
  request.numerical_backend_profile_id = std::string(mole::docking::kBackendProfileId);
  request.site_class = SiteClass::DryCore;
  request.coordinate_units = "ANGSTROM";
  request.scorer_torsion_assignment = {
      std::string(mole::docking::kD3VinaTorsionProfileId),
      std::string(mole::docking::kD3VinaTorsionProfileDigest),
      "sha256:" + std::string(64, 'b'),
      0.0};
  request.receptor_atoms = {make_atom("receptor-1", receptor, Vec3{0.0, 0.0, 0.0})};
  request.ligand_atoms = {make_atom("ligand-1", ligand, Vec3{distance, 0.0, 0.0})};
  return request;
}

double expected_hydrophobic(double surface_distance, bool receptor_hydrophobic,
                            bool ligand_hydrophobic) {
  if (!receptor_hydrophobic || !ligand_hydrophobic) return 0.0;
  if (surface_distance <= 0.5) return 1.0;
  if (surface_distance < 1.5) return 1.5 - surface_distance;
  return 0.0;
}

double expected_hydrogen_bond(double surface_distance, bool receptor_donor,
                              bool receptor_acceptor, bool ligand_donor,
                              bool ligand_acceptor) {
  const bool complementary =
      (receptor_donor && ligand_acceptor) || (receptor_acceptor && ligand_donor);
  if (!complementary) return 0.0;
  if (surface_distance <= -0.7) return 1.0;
  if (surface_distance < 0.0) return -surface_distance / 0.7;
  return 0.0;
}

void write_array(std::ofstream& output, const std::vector<int>& values) {
  output << '[';
  for (std::size_t index = 0; index < values.size(); ++index) {
    if (index != 0) output << ',';
    output << values[index];
  }
  output << ']';
}

}  // namespace

int main(int argc, char** argv) {
  try {
    require(argc == 2, "expected a JSON output path");
    std::vector<int> omitted_hyd_ids;
    std::vector<int> omitted_hb_ids;
    for (std::size_t ligand_id = 0; ligand_id < kTypes.size(); ++ligand_id) {
      if (!kTypes[ligand_id].hydrophobic) {
        omitted_hyd_ids.push_back(static_cast<int>(5 * ligand_id + 3));
      }
      if (!kTypes[ligand_id].donor && !kTypes[ligand_id].acceptor) {
        omitted_hb_ids.push_back(static_cast<int>(5 * ligand_id + 4));
      }
    }
    require(omitted_hyd_ids.size() == 11, "expected 11 exact-zero ligand HYD channels");
    require(omitted_hb_ids.size() == 10, "expected 10 exact-zero ligand HB channels");

    std::uint64_t checked_pairs = 0;
    std::uint64_t checked_pair_distances = 0;
    std::uint64_t hyd_zero_checks = 0;
    std::uint64_t hb_zero_checks = 0;
    for (const Type& receptor : kTypes) {
      require(mole::docking::xs_hydrophobic(receptor.id) == receptor.hydrophobic,
              "independent hydrophobic type table disagrees with the D3-TOR scorer");
      require(mole::docking::xs_donor(receptor.id) == receptor.donor,
              "independent donor type table disagrees with the D3-TOR scorer");
      require(mole::docking::xs_acceptor(receptor.id) == receptor.acceptor,
              "independent acceptor type table disagrees with the D3-TOR scorer");
      for (const Type& ligand : kTypes) {
        require(mole::docking::xs_hydrophobic(ligand.id) == ligand.hydrophobic,
                "independent hydrophobic type table disagrees with the D3-TOR scorer");
        require(mole::docking::xs_donor(ligand.id) == ligand.donor,
                "independent donor type table disagrees with the D3-TOR scorer");
        require(mole::docking::xs_acceptor(ligand.id) == ligand.acceptor,
                "independent acceptor type table disagrees with the D3-TOR scorer");
        ++checked_pairs;

        for (const double requested_surface : kSurfaceDistances) {
          const double radius_sum = receptor.radius + ligand.radius;
          const double distance = radius_sum + requested_surface;
          const double observed_surface = distance - radius_sum;
          const Request request = base_request(receptor, ligand, distance);
          const auto result = mole::docking::score_direct(request);
          require(result.valid, "direct scorer rejected a supported XS type pair");
          const double expected_hyd = expected_hydrophobic(
              observed_surface, receptor.hydrophobic, ligand.hydrophobic);
          const double expected_hb = expected_hydrogen_bond(
              observed_surface, receptor.donor, receptor.acceptor,
              ligand.donor, ligand.acceptor);
          require(std::abs(result.decomposition.raw[3] - expected_hyd) <= 1.0e-14,
                  "direct scorer HYD term disagrees with the independent equation oracle");
          require(std::abs(result.decomposition.raw[4] - expected_hb) <= 1.0e-14,
                  "direct scorer HB term disagrees with the independent equation oracle");

          if (!ligand.hydrophobic) {
            require(bits(result.decomposition.raw[3]) == 0U,
                    "omitted ligand HYD channel did not produce raw positive zero");
            ++hyd_zero_checks;
          }
          if (!ligand.donor && !ligand.acceptor) {
            require(bits(result.decomposition.raw[4]) == 0U,
                    "omitted ligand HB channel did not produce raw positive zero");
            ++hb_zero_checks;
          }
          ++checked_pair_distances;
        }
      }
    }

    const Type& carbon_h = kTypes[0];
    const Type& carbon_p = kTypes[1];
    const double carbon_distance = carbon_h.radius + carbon_p.radius + 0.25;
    const auto hyd_zero = mole::docking::score_direct(base_request(carbon_h, carbon_p, carbon_distance));
    require(hyd_zero.valid && bits(hyd_zero.decomposition.raw[3]) == 0U,
            "raw HYD zero must be positive binary64 zero");
    require(bits(hyd_zero.decomposition.weighted[3]) == 0x8000000000000000ULL,
            "negative HYD coefficient must yield negative binary64 zero");

    const Type& n_d = kTypes[3];
    const Type& n_p = kTypes[2];
    const double hb_distance = n_d.radius + n_p.radius - 0.5;
    const auto hb_zero = mole::docking::score_direct(base_request(n_d, n_p, hb_distance));
    require(hb_zero.valid && bits(hb_zero.decomposition.raw[4]) == 0U,
            "raw HB zero must be positive binary64 zero");
    require(bits(hb_zero.decomposition.weighted[4]) == 0x8000000000000000ULL,
            "negative HB coefficient must yield negative binary64 zero");

    std::ofstream output(argv[1], std::ios::binary);
    require(output.good(), "could not open direct scorer proof output");
    output << "{\n"
           << "  \"schema\": \"D3_SCI04_DIRECT_SCORER_PROOF_V1\",\n"
           << "  \"result\": \"PASS\",\n"
           << "  \"direct_scorer_commit\": \"f0bd2eaf47b02faab4dea694e7c2677094969076\",\n"
           << "  \"checked_type_pairs\": " << checked_pairs << ",\n"
           << "  \"checked_pair_distances\": " << checked_pair_distances << ",\n"
           << "  \"surface_distance_angstrom\": [-0.5, 0.25, 0.75, 1.25, 1.75],\n"
           << "  \"omitted_hyd_channel_count\": " << omitted_hyd_ids.size() << ",\n"
           << "  \"omitted_hyd_channel_ids\": ";
    write_array(output, omitted_hyd_ids);
    output << ",\n"
           << "  \"omitted_hyd_raw_positive_zero_checks\": " << hyd_zero_checks << ",\n"
           << "  \"omitted_hb_channel_count\": " << omitted_hb_ids.size() << ",\n"
           << "  \"omitted_hb_channel_ids\": ";
    write_array(output, omitted_hb_ids);
    output << ",\n"
           << "  \"omitted_hb_raw_positive_zero_checks\": " << hb_zero_checks << ",\n"
           << "  \"raw_positive_zero_bits\": \"0000000000000000\",\n"
           << "  \"negative_weighted_zero_bits\": \"" << hex_bits(bits(hyd_zero.decomposition.weighted[3])) << "\",\n"
           << "  \"hyd_raw_zero_and_weighted_negative_zero\": true,\n"
           << "  \"hb_raw_zero_and_weighted_negative_zero\": true,\n"
           << "  \"boundary_policy\": \"No cutoff-boundary tolerance is inferred by this proof.\"\n"
           << "}\n";
    require(output.good(), "failed while writing direct scorer proof output");
    return 0;
  } catch (const std::exception& error) {
    std::cerr << "D3-SCI-04 direct scorer proof failed: " << error.what() << '\n';
    return 1;
  }
}
