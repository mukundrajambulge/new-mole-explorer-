#include "mole/docking/scoring.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <fstream>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
#include <utility>
#include <vector>

namespace {

using mole::docking::Atom;
using mole::docking::Request;
using mole::docking::SiteClass;
using mole::docking::Vec3;

constexpr double kTolerance = 2.0e-15;

Atom atom(std::string uid, std::string type, std::string element, Vec3 position,
          int formal_charge, bool scoring_center = true) {
  return Atom{std::move(uid), std::move(type), position, formal_charge, std::nullopt,
              std::move(element), scoring_center};
}

void require(bool condition, const std::string& message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(1);
  }
}

bool close(double actual, double expected) {
  return std::abs(actual - expected) <= kTolerance * std::max(1.0, std::abs(expected));
}

Request base_request() {
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
  request.receptor_atoms = {atom("r1", "C_H", "C", Vec3{0.0, 0.0, 0.0}, 0)};
  request.ligand_atoms = {atom("l1", "C_H", "C", Vec3{3.8, 0.0, 0.0}, 0)};
  return request;
}

void set_n_tors(Request& request, double n_tors_vina) {
  request.scorer_torsion_assignment.n_tors_vina = n_tors_vina;
}

void test_xs_type_table() {
  struct TypeRadius final { const char* type; const char* element; double radius; };
  constexpr std::array<TypeRadius, 16> types{{
      {"C_H", "C", 1.9}, {"C_P", "C", 1.9}, {"N_P", "N", 1.8}, {"N_D", "N", 1.8},
      {"N_A", "N", 1.8}, {"N_DA", "N", 1.8}, {"O_P", "O", 1.7}, {"O_D", "O", 1.7},
      {"O_A", "O", 1.7}, {"O_DA", "O", 1.7}, {"S_P", "S", 2.0}, {"P_P", "P", 2.1},
      {"F_H", "F", 1.5}, {"Cl_H", "Cl", 1.8}, {"Br_H", "Br", 2.0}, {"I_H", "I", 2.2}}};
  for (const auto& [type, element, radius] : types) {
    const auto observed = mole::docking::xs_radius(type);
    require(observed.has_value() && *observed == radius, std::string("SCORE-FX-001 XS radius ") + type);
    require(mole::docking::xs_element_matches(type, element), std::string("SCORE-FX-001 XS element ") + type);
  }
  require(!mole::docking::xs_element_matches("C_H", "N"), "XS type cannot be assigned to a mismatched element");
  require(!mole::docking::xs_radius("B").has_value(), "SCORE-FX-018 boron has no fallback type");
  require(!mole::docking::xs_radius("Se").has_value(), "SCORE-FX-019 selenium has no fallback type");
  require(!mole::docking::xs_radius("Zn").has_value(), "SCORE-FX-020 metal has no fallback type");
  require(mole::docking::xs_hydrophobic("C_H") && mole::docking::xs_hydrophobic("F_H") &&
              mole::docking::xs_hydrophobic("Cl_H") && mole::docking::xs_hydrophobic("Br_H") &&
              mole::docking::xs_hydrophobic("I_H"), "SCORE-FX-006 hydrophobic XS set");
  require(!mole::docking::xs_hydrophobic("C_P") && !mole::docking::xs_hydrophobic("N_P"),
          "SCORE-FX-005 polar XS types are not hydrophobic");
  require(mole::docking::xs_donor("N_D") && mole::docking::xs_donor("N_DA") &&
              mole::docking::xs_donor("O_D") && mole::docking::xs_donor("O_DA"),
          "SCORE-FX-004 donor set");
  require(mole::docking::xs_acceptor("N_A") && mole::docking::xs_acceptor("N_DA") &&
              mole::docking::xs_acceptor("O_A") && mole::docking::xs_acceptor("O_DA"),
          "SCORE-FX-004 acceptor set");
  require(!mole::docking::xs_donor("N_P") && !mole::docking::xs_acceptor("O_P"),
          "SCORE-FX-005 N_P/O_P do not form a hydrogen bond");

  const auto carbon_nonpolar = mole::docking::assign_xs_type({"C", false, false, false});
  const auto carbon_polar = mole::docking::assign_xs_type({"C", true, false, false});
  require(carbon_nonpolar.type_id == "C_H" && carbon_polar.type_id == "C_P",
          "SCORE-FX-019 carbon heteroatom context controls C_H/C_P");
  const auto amide_n = mole::docking::assign_xs_type({"N", std::nullopt, true, false});
  const auto pyridine_n = mole::docking::assign_xs_type({"N", std::nullopt, false, true});
  const auto pyrrole_n = mole::docking::assign_xs_type({"N", std::nullopt, true, false});
  const auto quaternary_n = mole::docking::assign_xs_type({"N", std::nullopt, false, false});
  require(amide_n.type_id == "N_D" && pyridine_n.type_id == "N_A" &&
              pyrrole_n.type_id == "N_D" && quaternary_n.type_id == "N_P",
          "SCORE-FX-009..011 N/O role classes map to canonical XS labels");
  const auto ambiguous_n = mole::docking::assign_xs_type({"N", std::nullopt, std::nullopt, true});
  require(ambiguous_n.status == mole::docking::TypingStatus::Ambiguous,
          "state-dependent N/O typing fails closed when a donor role is unresolved");
  const auto unsupported_sulfur = mole::docking::assign_xs_type({"S", std::nullopt, false, true});
  require(unsupported_sulfur.status == mole::docking::TypingStatus::Unsupported,
          "SCORE-FX-017 unsupported sulfur acceptor chemistry fails closed");
  const auto unsupported_boron = mole::docking::assign_xs_type({"B", std::nullopt, std::nullopt, std::nullopt});
  const auto unsupported_selenium = mole::docking::assign_xs_type({"Se", std::nullopt, std::nullopt, std::nullopt});
  require(unsupported_boron.status == mole::docking::TypingStatus::Unsupported &&
              unsupported_selenium.status == mole::docking::TypingStatus::Unsupported,
          "SCORE-FX-018/019 unsupported elements receive no fallback type");
}

void test_independent_pair_oracle_and_decomposition() {
  Request request = base_request();
  request.receptor_atoms = {atom("r1", "N_D", "N", Vec3{0.0, 0.0, 0.0}, 0)};
  request.ligand_atoms = {atom("l1", "O_A", "O", Vec3{3.0, 0.0, 0.0}, 0)};
  set_n_tors(request, 3.0);
  const auto result = mole::docking::score_direct(request);
  require(result.valid, "SCORE-FX-002/003/004 pair is valid");
  require(result.receptor_state_digest == request.receptor_state_digest &&
              result.ligand_state_digest == request.ligand_state_digest &&
              result.coordinate_state_digest == request.coordinate_state_digest &&
              result.search_region_digest == request.search_region_digest &&
              result.scoring_profile_digest == request.scoring_profile_digest &&
              result.typing_profile_digest == request.typing_profile_digest &&
              result.chemistry_profile_digest == request.chemistry_profile_digest &&
              result.numerical_backend_profile_digest == request.numerical_backend_profile_digest &&
              result.receptor_typing_assignment_digest == request.receptor_typing_assignment_digest &&
              result.ligand_typing_assignment_digest == request.ligand_typing_assignment_digest,
          "SCORE-FX-040 direct result carries state, region, profile and typing digests");
  // Independent formula oracle: radius 1.8+1.7, r=3, so d=-0.5.
  // G1=e^-1; G2=e^-3.0625; REP=0.25; HB=5/7; HYD=0.
  require(close(result.decomposition.raw[0], 0.3678794411714423216), "SCORE-FX-002 G1 oracle");
  require(close(result.decomposition.raw[1], 0.046770622383958984), "SCORE-FX-002 G2 oracle");
  require(close(result.decomposition.raw[2], 0.25), "SCORE-FX-003 overlap oracle");
  require(result.decomposition.raw[3] == 0.0, "SCORE-FX-005 polar pair has no hydrophobic term");
  require(close(result.decomposition.raw[4], 5.0 / 7.0), "SCORE-FX-004 HB linear branch oracle");
  constexpr std::array<double, 5> coefficients{-0.035579, -0.005156, 0.840245, -0.035069, -0.587439};
  constexpr std::array<double, 5> weighted_oracle{
      -0.013088782637438746, -0.00024114932901169252, 0.21006125, 0.0, -0.4195992857142857};
  double weighted_total = 0.0;
  for (std::size_t index = 0; index < coefficients.size(); ++index) {
    require(close(result.decomposition.weighted[index], result.decomposition.raw[index] * coefficients[index]),
            "SCORE-FX-001 weighted term uses frozen coefficient");
    require(close(result.decomposition.weighted[index], weighted_oracle[index]),
            "independent high-precision weighted-term oracle");
    weighted_total += result.decomposition.weighted[index];
  }
  require(close(result.decomposition.inter_score, weighted_total) &&
              close(result.decomposition.inter_score, -0.22286796768073615),
          "SCORE-FX-032 independent E_inter decomposition oracle");
  require(close(result.decomposition.torsion_divisor, 1.17538) &&
              close(result.decomposition.empirical_score, -0.18961354428417716),
          "independent torsion-corrected empirical score oracle");

  request = base_request();
  request.ligand_atoms[0].position = Vec3{6.8, 0.0, 0.0};
  const auto gaussian2_center = mole::docking::score_direct(request);
  require(gaussian2_center.valid && gaussian2_center.decomposition.raw[1] == 1.0,
          "SCORE-FX-002 G2 is one at d=3");
  request.ligand_atoms[0].position = Vec3{2.8, 0.0, 0.0};
  const auto repulsion = mole::docking::score_direct(request);
  require(repulsion.valid && repulsion.decomposition.raw[2] == 1.0,
          "SCORE-FX-003 REP is one at d=-1");
  request.ligand_atoms[0].position = Vec3{4.8, 0.0, 0.0};
  const auto no_repulsion = mole::docking::score_direct(request);
  require(no_repulsion.valid && no_repulsion.decomposition.raw[2] == 0.0,
          "SCORE-FX-003 REP is zero at d=+1");
}

void test_hydrophobic_piecewise_and_cutoff() {
  Request request = base_request();
  const auto hydrophobic = mole::docking::score_direct(request);
  require(hydrophobic.valid, "SCORE-FX-006 hydrophobic fixture valid");
  require(hydrophobic.decomposition.raw[3] == 1.0, "SCORE-FX-006 d <= 0.5 plateau");

  request.ligand_atoms[0].position = Vec3{5.0, 0.0, 0.0};
  const auto shoulder = mole::docking::score_direct(request);
  require(shoulder.valid && close(shoulder.decomposition.raw[3], 0.3), "SCORE-FX-006 linear shoulder");

  request.ligand_atoms[0].position = Vec3{8.0, 0.0, 0.0};
  const auto at_cutoff = mole::docking::score_direct(request);
  require(at_cutoff.valid, "SCORE-FX-001 exact cutoff remains valid");
  for (double term : at_cutoff.decomposition.raw) require(term == 0.0, "all terms are zero at r=8 Angstrom");

  request.ligand_atoms[0].position = Vec3{5.3, 0.0, 0.0};
  const auto at_hydrophobic_end = mole::docking::score_direct(request);
  require(at_hydrophobic_end.valid && at_hydrophobic_end.decomposition.raw[3] == 0.0,
          "SCORE-FX-006 hydrophobic term is zero at d=1.5");

  request.receptor_atoms[0].xs_type = "N_D";
  request.receptor_atoms[0].element = "N";
  request.ligand_atoms[0].xs_type = "O_A";
  request.ligand_atoms[0].element = "O";
  request.ligand_atoms[0].position = Vec3{2.8, 0.0, 0.0};
  const auto hb_plateau = mole::docking::score_direct(request);
  require(hb_plateau.valid && hb_plateau.decomposition.raw[4] == 1.0,
          "SCORE-FX-004 hydrogen-bond plateau at d=-0.7");
  request.ligand_atoms[0].position = Vec3{3.15, 0.0, 0.0};
  const auto hb_midpoint = mole::docking::score_direct(request);
  require(hb_midpoint.valid && close(hb_midpoint.decomposition.raw[4], 0.5),
          "SCORE-FX-004 hydrogen-bond linear midpoint at d=-0.35");
  request.ligand_atoms[0].position = Vec3{3.5, 0.0, 0.0};
  const auto hb_zero = mole::docking::score_direct(request);
  require(hb_zero.valid && hb_zero.decomposition.raw[4] == 0.0,
          "SCORE-FX-004 hydrogen-bond term is zero at d=0");
}

void test_charge_domain_and_torsion_divisor() {
  Request request = base_request();
  request.ligand_atoms[0].formal_charge = -1;
  require(mole::docking::score_direct(request).valid, "SCORE-FX-012 net charge -1 supported");
  request.ligand_atoms[0].formal_charge = 1;
  require(mole::docking::score_direct(request).valid, "SCORE-FX-007 net charge +1 supported");
  request.ligand_atoms[0].formal_charge = 2;
  require(mole::docking::score_direct(request).diagnostic_code == "SCORING_CHEMISTRY_OUTSIDE_VALIDATED_DOMAIN",
          "SCORE-FX-015 outside net charge domain rejected");
  request.ligand_atoms[0].formal_charge = std::nullopt;
  require(mole::docking::score_direct(request).diagnostic_code == "AMBIGUOUS_LIGAND_FORMAL_CHARGE",
          "ambiguous ligand charge rejected");

  request = base_request();
  const auto base = mole::docking::score_direct(request);
  for (const double torsions : {0.0, 0.5, 1.0, 1.5, 2.0, 15.0}) {
    set_n_tors(request, torsions);
    const auto score = mole::docking::score_direct(request);
    const double expected_divisor = 1.0 + 0.05846 * torsions;
    require(score.valid && score.decomposition.torsion_divisor == expected_divisor,
            "D3-TOR-01 exact Vina divisor for N_tors=" + std::to_string(torsions));
    require(score.decomposition.empirical_score == base.decomposition.inter_score / expected_divisor,
            "SCORE-FX-037/038 scoring torsion count controls divisor");
  }
  set_n_tors(request, 0.5);
  request.search_torsion_count = 8;
  const auto scorer_torsions = mole::docking::score_direct(request);
  request.search_torsion_count = 2;
  const auto search_torsions_changed = mole::docking::score_direct(request);
  require(scorer_torsions.valid && search_torsions_changed.valid &&
              scorer_torsions.decomposition.empirical_score == search_torsions_changed.decomposition.empirical_score,
          "SCORE-FX-038 search torsion metadata cannot replace scorer torsion count");

  set_n_tors(request, 0.25);
  require(mole::docking::score_direct(request).diagnostic_code == "SCORER_TORSION_ASSIGNMENT_INVALID",
          "fractional N_tors values outside exact half units fail closed");
  set_n_tors(request, -0.5);
  require(mole::docking::score_direct(request).diagnostic_code == "SCORER_TORSION_ASSIGNMENT_INVALID",
          "negative N_tors values fail closed");
  set_n_tors(request, std::numeric_limits<double>::quiet_NaN());
  require(mole::docking::score_direct(request).diagnostic_code == "SCORER_TORSION_ASSIGNMENT_INVALID",
          "non-finite N_tors values fail closed");
  set_n_tors(request, 1.0);
  request.scorer_torsion_assignment.profile_id = "ME_DOCKING_V1_KINEMATIC_MODEL_1_0";
  require(mole::docking::score_direct(request).diagnostic_code == "SCORER_TORSION_PROFILE_MISMATCH",
          "D2 integer scorer profile cannot be passed as the D3 Vina torsion profile");
}

void test_boundary_validation_and_determinism() {
  Request request = base_request();
  request.ligand_atoms[0].position = Vec3{0.0, 0.0, 0.0};
  const auto zero_distance = mole::docking::score_direct(request);
  require(zero_distance.valid && std::isfinite(zero_distance.decomposition.empirical_score),
          "SCORE-FX-026 zero distance has a finite score");
  require(!zero_distance.gradient_valid, "SCORE-FX-026 gradient validity is false at r=0");

  request.ligand_atoms[0].position.x = std::numeric_limits<double>::quiet_NaN();
  require(mole::docking::score_direct(request).diagnostic_code == "SCORING_NONFINITE_RESULT",
          "SCORE-FX-027 NaN coordinate rejected");

  request = base_request();
  const auto original_score = mole::docking::score_direct(request);
  request.ligand_atoms[0].imported_partial_charge = 0.87;
  const auto positive_partial_charge = mole::docking::score_direct(request);
  request.ligand_atoms[0].imported_partial_charge = -0.43;
  const auto negative_partial_charge = mole::docking::score_direct(request);
  require(original_score.valid && positive_partial_charge.valid && negative_partial_charge.valid &&
              original_score.decomposition.empirical_score == positive_partial_charge.decomposition.empirical_score &&
              original_score.decomposition.empirical_score == negative_partial_charge.decomposition.empirical_score,
          "SCORE-FX-039 imported partial charge does not affect the score");

  request = base_request();
  request.receptor_atoms[0].xs_type = "C_H";
  request.receptor_atoms[0].element = "N";
  require(mole::docking::score_direct(request).diagnostic_code == "SCORING_ATOM_TYPE_UNSUPPORTED",
          "element-incompatible XS assignment rejected");

  request = base_request();
  request.ligand_atoms.push_back(atom("lh", "", "H", Vec3{3.8, 1.0, 0.0}, 0, false));
  const auto with_explicit_hydrogen = mole::docking::score_direct(request);
  require(with_explicit_hydrogen.valid &&
              with_explicit_hydrogen.decomposition.empirical_score == original_score.decomposition.empirical_score,
          "explicit hydrogen helper is retained as state but excluded as a score center");

  request = base_request();
  request.ligand_atoms[0].xs_type = "UNMAPPED";
  require(mole::docking::score_direct(request).diagnostic_code == "SCORING_ATOM_TYPE_UNSUPPORTED",
          "SCORE-FX-028 unknown XS type fails closed");

  request = base_request();
  request.site_class = SiteClass::WaterDependent;
  require(mole::docking::score_direct(request).diagnostic_code == "SCORING_UNSUPPORTED_EXPLICIT_WATER",
          "SCORE-FX-025 water-dependent site unsupported");

  request = base_request();
  request.receptor_atoms = {atom("r2", "C_H", "C", Vec3{0.0, 0.0, 0.0}, 0),
                            atom("r1", "N_D", "N", Vec3{0.0, 0.0, 0.1}, 0)};
  request.ligand_atoms = {atom("l2", "O_A", "O", Vec3{3.0, 0.0, 0.0}, 0),
                          atom("l1", "C_H", "C", Vec3{4.0, 0.0, 0.0}, 0)};
  const auto first_order = mole::docking::score_direct(request);
  std::reverse(request.receptor_atoms.begin(), request.receptor_atoms.end());
  std::reverse(request.ligand_atoms.begin(), request.ligand_atoms.end());
  const auto permuted_order = mole::docking::score_direct(request);
  require(first_order.valid && permuted_order.valid, "SCORE-FX-040 both atom orders valid");
  require(first_order.decomposition.raw == permuted_order.decomposition.raw &&
              first_order.decomposition.weighted == permuted_order.decomposition.weighted &&
              first_order.decomposition.empirical_score == permuted_order.decomposition.empirical_score,
          "SCORE-FX-040 stable AtomUID order gives identical direct result");
}

void test_profile_site_and_provenance_rejection() {
  Request request = base_request();
  request.scoring_profile_id = "OTHER_SCORING_PROFILE";
  require(mole::docking::score_direct(request).diagnostic_code == "SCORING_PROFILE_MISMATCH",
          "incompatible scoring profile rejected");

  request = base_request();
  request.ligand_typing_profile_id = "OTHER_TYPING_PROFILE";
  require(mole::docking::score_direct(request).diagnostic_code == "SCORING_TYPING_PROFILE_MISMATCH",
          "incompatible ligand typing profile rejected");

  request = base_request();
  request.chemistry_profile_id = "OTHER_CHEMISTRY_PROFILE";
  require(mole::docking::score_direct(request).diagnostic_code == "SCORING_CHEMISTRY_PROFILE_MISMATCH",
          "incompatible chemistry profile rejected");

  request = base_request();
  request.numerical_backend_profile_id = "OTHER_NUMERICAL_BACKEND";
  require(mole::docking::score_direct(request).diagnostic_code == "NUMERICAL_BACKEND_UNSUPPORTED",
          "nonreference numerical backend rejected by direct oracle");

  request = base_request();
  request.site_class = SiteClass::Metal;
  require(mole::docking::score_direct(request).diagnostic_code == "SCORING_UNSUPPORTED_METAL_SITE",
          "SCORE-FX-022 site-influencing metal rejected");
  request.site_class = SiteClass::Cofactor;
  require(mole::docking::score_direct(request).diagnostic_code == "SCORING_UNSUPPORTED_COFACTOR",
          "SCORE-FX-023 essential cofactor rejected");

  request = base_request();
  request.search_region_digest = "not-a-digest";
  require(mole::docking::score_direct(request).diagnostic_code == "INVALID_PROVENANCE_DIGEST",
          "incomplete SearchRegion provenance rejected");

  request = base_request();
  request.receptor_atoms.push_back(request.receptor_atoms.front());
  require(mole::docking::score_direct(request).diagnostic_code == "INVALID_ATOM_UID_ORDER",
          "duplicate receptor AtomUID rejected");
}

}  // namespace

void test_halogen_element_case() {
  const char* spellings[][2] = {{"Cl", "CL"}, {"Br", "BR"}, {"I", "I"}};
  const char* types[] = {"Cl_H", "Br_H", "I_H"};
  const auto unknown = mole::docking::assign_xs_type({"XX", std::nullopt, false, false});
  require(unknown.status == mole::docking::TypingStatus::Unsupported, "unknown element yields a diagnostic, not a type");
  for (int i = 0; i < 3; ++i) {
    for (const char* sp : spellings[i]) {
      const auto a = mole::docking::assign_xs_type({sp, std::nullopt, false, false});
      require(a.status == mole::docking::TypingStatus::Supported && a.type_id == types[i],
              "halogen element spelling is case-insensitive");
      Request request = base_request();
      request.receptor_atoms = {atom("r1", "C_H", "C", Vec3{0.0, 0.0, 0.0}, 0)};
      request.ligand_atoms = {atom("l1", types[i], sp, Vec3{4.0, 0.0, 0.0}, 0)};
      require(mole::docking::score_direct(request).valid, "halogen ligand scores with any element case");
    }
  }
}

// Reads atoms from a PDBQT fixture as the TypeScript boundary hands them over:
// element upper-cased (CL, BR) from the AutoDock atom-type column.
std::vector<Atom> read_pdbqt_fixture(const std::string& path, const std::string& prefix) {
  std::ifstream in(path);
  require(in.good(), "fixture readable: " + path);
  std::vector<Atom> atoms;
  std::string line;
  while (std::getline(in, line)) {
    while (!line.empty() && (line.back() == 0x0D || line.back() == ' ')) line.pop_back();
    if (line.rfind("ATOM", 0) != 0 || line.size() < 54) continue;
    const double x = std::stod(line.substr(30, 8));
    const double y = std::stod(line.substr(38, 8));
    const double z = std::stod(line.substr(46, 8));
    const std::string t = line.substr(line.find_last_of(' ') + 1);
    if (t == "HD") continue;  // hydrogens are not scoring atoms
    std::string el = t;
    std::string type = "H";
    if (t == "CL") type = "Cl_H";
    else if (t == "BR") type = "Br_H";
    else if (t == "I") type = "I_H";
    else if (t == "C") type = "C_H";
    else if (t == "N") type = "N_P";
    else if (t == "OA") { type = "O_A"; el = "O"; }
    else if (t == "SA") { type = "S_P"; el = "S"; }
    else if (t == "HD") el = "H";
    atoms.push_back(atom(prefix + std::to_string(atoms.size()), type, el, Vec3{x, y, z}, 0, t != "HD"));
  }
  return atoms;
}

void test_halogen_fixture_scores_against_multitype_receptor() {
  const std::string dir = MOLE_FIXTURE_DIR;
  const auto receptor = read_pdbqt_fixture(dir + "/multitype-receptor.pdbqt", "r");
  const auto ligand = read_pdbqt_fixture(dir + "/halogen-ligand.pdbqt", "l");
  require(receptor.size() == 4 && ligand.size() == 4, "fixtures parsed");
  for (const auto& a : ligand) {
    if (a.element == "C") continue;
    const auto t = mole::docking::assign_xs_type({a.element, std::nullopt, false, false});
    require(t.status == mole::docking::TypingStatus::Supported, "uppercase element types: " + a.element);
  }
  Request request = base_request();
  request.receptor_atoms = receptor;
  request.ligand_atoms = ligand;
  set_n_tors(request, 1.0);
  const auto scored = mole::docking::score_direct(request);
  require(scored.valid, "Cl/Br/I ligand scores against multi-type receptor: " + scored.diagnostic);
}

int main() {
  test_halogen_fixture_scores_against_multitype_receptor();
  test_halogen_element_case();
  test_xs_type_table();
  test_independent_pair_oracle_and_decomposition();
  test_hydrophobic_piecewise_and_cutoff();
  test_charge_domain_and_torsion_divisor();
  test_boundary_validation_and_determinism();
  test_profile_site_and_provenance_rejection();
  std::cout << "PASS: direct-scoring unit fixtures (6 groups)\n";
  return 0;
}
