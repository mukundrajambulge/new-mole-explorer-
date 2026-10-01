#include <windows.h>
#include <psapi.h>

#include <algorithm>
#include <array>
#include <bit>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <limits>
#include <memory_resource>
#include <numeric>
#include <stdexcept>
#include <string>
#include <string_view>
#include <vector>

namespace {

constexpr std::size_t kAxisPoints = 110;
constexpr std::size_t kPointCount = kAxisPoints * kAxisPoints * kAxisPoints;
constexpr std::size_t kLogicalChannels = 80;
constexpr std::size_t kPhysicalArrays = 59;
constexpr std::size_t kReceptorAtoms = 250'000;
constexpr std::size_t kResidues = 50'000;
constexpr std::size_t kBuildWorkers = 8;
constexpr std::size_t kWorkChunkPoints = 512;
constexpr std::uint64_t kMiB = 1024ULL * 1024ULL;
constexpr std::uint64_t kGiB = 1024ULL * 1024ULL * 1024ULL;
constexpr std::uint64_t kRawPayloadLimit = 768ULL * kMiB;
constexpr std::uint64_t kFieldAllocationLimit = 1ULL * kGiB;
constexpr std::uint64_t kDefaultAttemptRssLimit = 2ULL * kGiB;
constexpr std::uint64_t kSafetyAttemptRssLimit = 4ULL * kGiB;

struct MeteredResource final : std::pmr::memory_resource {
  std::pmr::memory_resource* upstream{std::pmr::new_delete_resource()};
  std::uint64_t live_bytes{};
  std::uint64_t peak_live_bytes{};
  std::uint64_t allocation_calls{};
  std::uint64_t total_requested_bytes{};

  void* do_allocate(std::size_t bytes, std::size_t alignment) override {
    void* result = upstream->allocate(bytes, alignment);
    live_bytes += static_cast<std::uint64_t>(bytes);
    peak_live_bytes = std::max(peak_live_bytes, live_bytes);
    ++allocation_calls;
    total_requested_bytes += static_cast<std::uint64_t>(bytes);
    return result;
  }

  void do_deallocate(void* pointer, std::size_t bytes, std::size_t alignment) override {
    live_bytes -= static_cast<std::uint64_t>(bytes);
    upstream->deallocate(pointer, bytes, alignment);
  }

  bool do_is_equal(const std::pmr::memory_resource& other) const noexcept override {
    return this == &other;
  }
};

struct Vec3 final {
  double x;
  double y;
  double z;
};

struct GridMetadata final {
  std::array<double, 3> origin;
  double spacing;
  std::array<std::uint32_t, 3> dimensions;
  std::array<std::uint8_t, 80> logical_to_physical;
  std::array<std::uint8_t, 6 * 32> dependency_digests;
  std::array<char, 40> logical_schema_id;
  std::array<char, 48> physical_schema_id;
  std::uint32_t receptor_atom_count;
  std::uint32_t residue_count;
  std::uint16_t physical_channel_count;
  std::uint16_t logical_channel_count;
};

struct ChannelMapEntry final {
  std::uint16_t logical_id;
  std::int16_t physical_ordinal;
  std::uint8_t xs_id;
  std::uint8_t term_id;
  std::uint16_t reserved;
};

struct PhysicalChannel final {
  std::uint16_t logical_id;
  std::uint8_t xs_id;
  std::uint8_t term_id;
  std::uint32_t reserved;
  std::pmr::vector<double> values;

  PhysicalChannel(std::uint16_t logical, std::uint8_t xs, std::uint8_t term,
                  std::pmr::memory_resource* resource)
      : logical_id(logical), xs_id(xs), term_id(term), reserved(0), values(resource) {}
  PhysicalChannel(PhysicalChannel&&) noexcept = default;
  PhysicalChannel& operator=(PhysicalChannel&&) noexcept = default;
  PhysicalChannel(const PhysicalChannel&) = delete;
  PhysicalChannel& operator=(const PhysicalChannel&) = delete;
};

struct SpatialAtom final {
  double x;
  double y;
  double z;
  std::uint32_t atom_uid;
  std::uint16_t residue_id;
  std::uint8_t xs_id;
  std::uint8_t flags;
};

struct ResidueDescriptor final {
  std::uint32_t residue_uid;
  std::uint32_t atom_begin;
  std::uint32_t atom_count;
  std::uint32_t flags;
};

struct SpatialNode final {
  Vec3 minimum;
  Vec3 maximum;
  std::uint32_t left;
  std::uint32_t right;
  std::uint32_t begin;
  std::uint32_t count;
};

struct TypeCapabilities final {
  bool hydrophobic;
  bool donor;
  bool acceptor;
};

constexpr std::array<TypeCapabilities, 16> kTypeCapabilities{{
    {true, false, false},  {false, false, false}, {false, false, false},
    {false, true, false},  {false, false, true},  {false, true, true},
    {false, false, false}, {false, true, false},  {false, false, true},
    {false, true, true},   {false, false, false}, {false, false, false},
    {true, false, false},  {true, false, false},  {true, false, false},
    {true, false, false},
}};

struct Component final {
  std::string_view name;
  std::uint64_t bytes{};
};

MeteredResource g_resource;
std::pmr::vector<SpatialAtom>* g_atoms{};
std::pmr::vector<std::uint32_t>* g_order{};
std::pmr::vector<SpatialNode>* g_nodes{};
std::uint32_t g_next_node{};

SpatialNode combine(const SpatialNode& left, const SpatialNode& right) {
  return SpatialNode{
      Vec3{std::min(left.minimum.x, right.minimum.x),
           std::min(left.minimum.y, right.minimum.y),
           std::min(left.minimum.z, right.minimum.z)},
      Vec3{std::max(left.maximum.x, right.maximum.x),
           std::max(left.maximum.y, right.maximum.y),
           std::max(left.maximum.z, right.maximum.z)},
      0, 0, 0, 0};
}

std::uint32_t build_bvh(std::uint32_t begin, std::uint32_t end) {
  const std::uint32_t node_id = g_next_node++;
  SpatialNode node{};
  if (end - begin == 1U) {
    const SpatialAtom& atom = (*g_atoms)[(*g_order)[begin]];
    node.minimum = Vec3{atom.x, atom.y, atom.z};
    node.maximum = node.minimum;
    node.left = std::numeric_limits<std::uint32_t>::max();
    node.right = std::numeric_limits<std::uint32_t>::max();
    node.begin = begin;
    node.count = 1;
    (*g_nodes)[node_id] = node;
    return node_id;
  }

  const std::uint32_t middle = begin + (end - begin) / 2U;
  const std::uint32_t left_id = build_bvh(begin, middle);
  const std::uint32_t right_id = build_bvh(middle, end);
  node = combine((*g_nodes)[left_id], (*g_nodes)[right_id]);
  node.left = left_id;
  node.right = right_id;
  node.begin = begin;
  node.count = end - begin;
  (*g_nodes)[node_id] = node;
  return node_id;
}

PROCESS_MEMORY_COUNTERS_EX process_memory() {
  PROCESS_MEMORY_COUNTERS_EX counters{};
  counters.cb = sizeof(counters);
  const BOOL ok = GetProcessMemoryInfo(
      GetCurrentProcess(),
      reinterpret_cast<PROCESS_MEMORY_COUNTERS*>(&counters),
      static_cast<DWORD>(sizeof(counters)));
  if (ok == FALSE) throw std::runtime_error("GetProcessMemoryInfo failed");
  return counters;
}

void write_component_object(std::ofstream& output, const std::array<Component, 9>& components) {
  output << "  \"field_owned_components_requested_bytes\": {\n";
  for (std::size_t index = 0; index < components.size(); ++index) {
    output << "    \"" << components[index].name << "\": " << components[index].bytes;
    output << (index + 1 == components.size() ? "\n" : ",\n");
  }
  output << "  },\n";
}

}  // namespace

int main(int argc, char** argv) {
  try {
    static_assert(sizeof(void*) == 8, "The full-size resource model requires a 64-bit process.");
    static_assert(sizeof(SpatialAtom) == 32, "SpatialAtom size changed; update the model report.");
    static_assert(sizeof(SpatialNode) == 64, "SpatialNode size changed; update the model report.");
    if (argc != 2) throw std::runtime_error("expected a JSON output path");

    const auto build_started = std::chrono::steady_clock::now();
    std::array<Component, 9> components{{
        {"field_metadata", 0},
        {"logical_and_physical_channel_descriptors", 0},
        {"physical_arrays_and_payload", 0},
        {"axis_coordinates", 0},
        {"receptor_atoms", 0},
        {"residue_descriptors", 0},
        {"spatial_bvh_nodes_and_order", 0},
        {"spatial_index_build_scratch", 0},
        {"parallel_field_build_scratch", 0},
    }};
    std::size_t component_index = 0;
    const auto allocate_component = [&](std::string_view name, auto&& action) {
      const std::uint64_t before = g_resource.live_bytes;
      action();
      components[component_index].name = name;
      components[component_index].bytes = g_resource.live_bytes - before;
      ++component_index;
    };

    std::pmr::vector<GridMetadata> metadata(&g_resource);
    allocate_component("field_metadata", [&] {
      metadata.emplace_back();
      GridMetadata& value = metadata.back();
      value.origin = {-20.375, -20.375, -20.375};
      value.spacing = 0.375;
      value.dimensions = {110, 110, 110};
      value.logical_to_physical.fill(std::numeric_limits<std::uint8_t>::max());
      value.dependency_digests.fill(0x5a);
      std::memcpy(value.logical_schema_id.data(), "ME_SCORING_FIELD_LOGICAL_80_V1", 31);
      std::memcpy(value.physical_schema_id.data(), "ME_SCORING_FIELD_EXACT_ZERO_59_RESEARCH_V1", 43);
      value.receptor_atom_count = static_cast<std::uint32_t>(kReceptorAtoms);
      value.residue_count = static_cast<std::uint32_t>(kResidues);
      value.physical_channel_count = static_cast<std::uint16_t>(kPhysicalArrays);
      value.logical_channel_count = static_cast<std::uint16_t>(kLogicalChannels);
    });

    std::pmr::vector<ChannelMapEntry> channel_map(&g_resource);
    std::pmr::vector<PhysicalChannel> physical_channels(&g_resource);
    allocate_component("logical_and_physical_channel_descriptors", [&] {
      channel_map.reserve(kLogicalChannels);
      physical_channels.reserve(kPhysicalArrays);
      std::int16_t physical = 0;
      GridMetadata& value = metadata.front();
      for (std::size_t xs_id = 0; xs_id < kTypeCapabilities.size(); ++xs_id) {
        for (std::size_t term_id = 0; term_id < 5; ++term_id) {
          const TypeCapabilities& capability = kTypeCapabilities[xs_id];
          const bool omitted_hyd = term_id == 3 && !capability.hydrophobic;
          const bool omitted_hb = term_id == 4 && !capability.donor && !capability.acceptor;
          const std::uint16_t logical = static_cast<std::uint16_t>(5 * xs_id + term_id);
          const std::int16_t physical_ordinal = (omitted_hyd || omitted_hb) ? -1 : physical++;
          channel_map.push_back(ChannelMapEntry{
              logical, physical_ordinal, static_cast<std::uint8_t>(xs_id),
              static_cast<std::uint8_t>(term_id), 0});
          if (physical_ordinal >= 0) {
            value.logical_to_physical[logical] = static_cast<std::uint8_t>(physical_ordinal);
          }
        }
      }
      if (channel_map.size() != kLogicalChannels || physical_channels.size() != 0 ||
          static_cast<std::size_t>(physical) != kPhysicalArrays) {
        throw std::runtime_error("80-logical/59-physical map construction failed");
      }
    });

    allocate_component("physical_arrays_and_payload", [&] {
      for (const ChannelMapEntry& entry : channel_map) {
        if (entry.physical_ordinal < 0) continue;
        physical_channels.emplace_back(entry.logical_id, entry.xs_id, entry.term_id, &g_resource);
        auto& values = physical_channels.back().values;
        values.reserve(kPointCount);
        values.resize(kPointCount);
        const double value = 0.125 + static_cast<double>(entry.logical_id) / 1024.0;
        std::fill(values.begin(), values.end(), value);
      }
    });

    std::pmr::vector<double> axis_coordinates(&g_resource);
    allocate_component("axis_coordinates", [&] {
      axis_coordinates.resize(3 * kAxisPoints);
      for (std::size_t axis = 0; axis < 3; ++axis) {
        for (std::size_t point = 0; point < kAxisPoints; ++point) {
          axis_coordinates[axis * kAxisPoints + point] =
              -20.375 + 0.375 * static_cast<double>(point);
        }
      }
    });

    std::pmr::vector<SpatialAtom> atoms(&g_resource);
    allocate_component("receptor_atoms", [&] {
      atoms.reserve(kReceptorAtoms);
      for (std::size_t index = 0; index < kReceptorAtoms; ++index) {
        const double x = static_cast<double>(index % 500U) * 0.25;
        const double y = static_cast<double>((index / 500U) % 500U) * 0.25;
        const double z = static_cast<double>(index / 250'000U) * 0.25;
        atoms.push_back(SpatialAtom{
            x, y, z, static_cast<std::uint32_t>(index),
            static_cast<std::uint16_t>(index / 5U),
            static_cast<std::uint8_t>(index % 16U), 0});
      }
    });

    std::pmr::vector<ResidueDescriptor> residues(&g_resource);
    allocate_component("residue_descriptors", [&] {
      residues.reserve(kResidues);
      for (std::size_t residue = 0; residue < kResidues; ++residue) {
        residues.push_back(ResidueDescriptor{
            static_cast<std::uint32_t>(residue),
            static_cast<std::uint32_t>(5U * residue), 5U, 0});
      }
    });

    std::pmr::vector<std::uint32_t> order(&g_resource);
    std::pmr::vector<SpatialNode> nodes(&g_resource);
    allocate_component("spatial_bvh_nodes_and_order", [&] {
      order.resize(kReceptorAtoms);
      std::iota(order.begin(), order.end(), 0U);
      std::sort(order.begin(), order.end(), [&atoms](std::uint32_t left, std::uint32_t right) {
        const SpatialAtom& a = atoms[left];
        const SpatialAtom& b = atoms[right];
        if (a.x != b.x) return a.x < b.x;
        if (a.y != b.y) return a.y < b.y;
        if (a.z != b.z) return a.z < b.z;
        return a.atom_uid < b.atom_uid;
      });
      nodes.resize(2 * kReceptorAtoms - 1);
      g_atoms = &atoms;
      g_order = &order;
      g_nodes = &nodes;
      g_next_node = 0;
      const std::uint32_t root = build_bvh(0, static_cast<std::uint32_t>(kReceptorAtoms));
      if (root != 0U || g_next_node != 2U * kReceptorAtoms - 1U) {
        throw std::runtime_error("maximum-size BVH construction failed");
      }
    });

    std::pmr::vector<std::uint32_t> spatial_scratch(&g_resource);
    allocate_component("spatial_index_build_scratch", [&] {
      spatial_scratch.resize(kReceptorAtoms);
      std::copy(order.begin(), order.end(), spatial_scratch.begin());
    });

    constexpr std::size_t kAccumulatorDoublesPerChannel = 2;
    const std::size_t scratch_count =
        kBuildWorkers * kWorkChunkPoints * kPhysicalArrays * kAccumulatorDoublesPerChannel;
    std::pmr::vector<double> field_build_scratch(&g_resource);
    allocate_component("parallel_field_build_scratch", [&] {
      field_build_scratch.resize(scratch_count);
      for (std::size_t index = 0; index < field_build_scratch.size(); ++index) {
        field_build_scratch[index] = static_cast<double>(index % 17U) / 64.0;
      }
    });

    const std::uint64_t raw_payload_bytes = [&] {
      std::uint64_t bytes = 0;
      for (const PhysicalChannel& channel : physical_channels) {
        bytes += static_cast<std::uint64_t>(channel.values.capacity()) * sizeof(double);
      }
      return bytes;
    }();
    const std::uint64_t expected_payload_bytes =
        static_cast<std::uint64_t>(kPointCount) * kPhysicalArrays * sizeof(double);
    if (physical_channels.size() != kPhysicalArrays ||
        raw_payload_bytes != expected_payload_bytes) {
      throw std::runtime_error("full-size physical array payload does not match 59 x 1,331,000 x 8");
    }

    std::uint64_t checksum_bits = 0;
    for (const PhysicalChannel& channel : physical_channels) {
      checksum_bits ^= std::bit_cast<std::uint64_t>(channel.values.front());
      checksum_bits ^= std::bit_cast<std::uint64_t>(channel.values.back());
    }
    checksum_bits ^= static_cast<std::uint64_t>(nodes.back().count);
    checksum_bits ^= static_cast<std::uint64_t>(axis_coordinates.back() * 1'000'000.0);
    const auto build_finished = std::chrono::steady_clock::now();
    const auto counters = process_memory();
    const double build_seconds =
        std::chrono::duration<double>(build_finished - build_started).count();

    const bool raw_cap_pass = raw_payload_bytes <= kRawPayloadLimit;
    const bool field_cap_pass = g_resource.peak_live_bytes <= kFieldAllocationLimit;
    const bool default_rss_pass = counters.PeakWorkingSetSize <= kDefaultAttemptRssLimit;
    const bool safety_rss_pass = counters.PeakWorkingSetSize <= kSafetyAttemptRssLimit;
    const bool caps_pass = raw_cap_pass && field_cap_pass && default_rss_pass && safety_rss_pass;

    std::ofstream output(argv[1], std::ios::binary);
    if (!output.good()) throw std::runtime_error("could not open resource model output");
    output << "{\n"
           << "  \"schema\": \"D3_SCI04_CPP_RESOURCE_MODEL_V1\",\n"
           << "  \"result\": \"" << (caps_pass ? "PASS_FOR_RESEARCH_MODEL" : "FAIL_FOR_RESEARCH_MODEL") << "\",\n"
           << "  \"model_scope\": \"test-only C++ allocation/build model; not a production ScoringField implementation\",\n"
           << "  \"target\": \"x86_64-windows-gnu\",\n"
           << "  \"grid_points_per_axis\": " << kAxisPoints << ",\n"
           << "  \"grid_point_count\": " << kPointCount << ",\n"
           << "  \"logical_channels\": " << kLogicalChannels << ",\n"
           << "  \"physical_arrays\": " << physical_channels.size() << ",\n"
           << "  \"receptor_scoring_atoms\": " << atoms.size() << ",\n"
           << "  \"receptor_residues\": " << residues.size() << ",\n"
           << "  \"field_build_worker_scratch_slots\": " << kBuildWorkers << ",\n"
           << "  \"model_construction_seconds\": " << std::fixed << std::setprecision(6) << build_seconds << ",\n";
    write_component_object(output, components);
    output << "  \"memory_metrics_bytes\": {\n"
           << "    \"raw_field_payload\": " << raw_payload_bytes << ",\n"
           << "    \"total_field_owned_requested_allocation_current\": " << g_resource.live_bytes << ",\n"
           << "    \"total_field_owned_requested_allocation_peak\": " << g_resource.peak_live_bytes << ",\n"
           << "    \"peak_working_set_rss\": " << counters.PeakWorkingSetSize << ",\n"
           << "    \"current_working_set_rss\": " << counters.WorkingSetSize << ",\n"
           << "    \"peak_pagefile_usage\": " << counters.PeakPagefileUsage << ",\n"
           << "    \"private_usage\": " << counters.PrivateUsage << ",\n"
           << "    \"allocation_calls\": " << g_resource.allocation_calls << ",\n"
           << "    \"checksum_bits\": \"" << std::hex << std::setw(16) << std::setfill('0') << checksum_bits << std::dec << "\"\n"
           << "  },\n"
           << "  \"resource_limits_bytes\": {\n"
           << "    \"raw_field_payload\": " << kRawPayloadLimit << ",\n"
           << "    \"total_field_owned_allocation\": " << kFieldAllocationLimit << ",\n"
           << "    \"default_per_attempt_rss\": " << kDefaultAttemptRssLimit << ",\n"
           << "    \"ordinary_v1_safety_rss\": " << kSafetyAttemptRssLimit << "\n"
           << "  },\n"
           << "  \"cap_checks\": {\n"
           << "    \"raw_payload_pass\": " << (raw_cap_pass ? "true" : "false") << ",\n"
           << "    \"field_allocation_pass\": " << (field_cap_pass ? "true" : "false") << ",\n"
           << "    \"default_attempt_rss_pass\": " << (default_rss_pass ? "true" : "false") << ",\n"
           << "    \"safety_attempt_rss_pass\": " << (safety_rss_pass ? "true" : "false") << "\n"
           << "  },\n"
           << "  \"accounting_limitations\": [\n"
           << "    \"Field-owned allocation counts requested PMR bytes; allocator bookkeeping and executable/runtime memory are excluded from that metric.\",\n"
           << "    \"RSS is the Windows process peak working set for this isolated model process.\",\n"
           << "    \"The spatial tree and scratch layout are explicit research candidates; production resource acceptance requires measuring the eventual production layout.\"\n"
           << "  ]\n"
           << "}\n";
    if (!output.good()) throw std::runtime_error("failed while writing resource model output");

    std::cout << "D3-SCI-04 resource model: " << (caps_pass ? "PASS_FOR_RESEARCH_MODEL" : "FAIL_FOR_RESEARCH_MODEL")
              << ", raw=" << raw_payload_bytes
              << ", field-owned-requested=" << g_resource.peak_live_bytes
              << ", peak-RSS=" << counters.PeakWorkingSetSize
              << ", checksum=0x" << std::hex << checksum_bits << std::dec << '\n';
    return caps_pass ? 0 : 2;
  } catch (const std::exception& error) {
    std::cerr << "D3-SCI-04 C++ resource model failed: " << error.what() << '\n';
    return 1;
  }
}
