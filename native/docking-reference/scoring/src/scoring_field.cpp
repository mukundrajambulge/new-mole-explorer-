#include "mole/docking/scoring_field.hpp"

#include <algorithm>
#include <array>
#include <bit>
#include <cfenv>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <functional>
#include <limits>
#include <new>
#include <numeric>
#include <string>
#include <utility>

#if defined(__SSE__)
#include <xmmintrin.h>
#endif

namespace mole::docking {
namespace {

static_assert(std::numeric_limits<double>::is_iec559 &&
              std::numeric_limits<double>::radix == 2 &&
              std::numeric_limits<double>::digits == 53,
              "Scoring fields require IEEE-754 binary64 values");

constexpr std::uint32_t kSha256RoundConstants[64]{
    0x428a2f98U, 0x71374491U, 0xb5c0fbcfU, 0xe9b5dba5U, 0x3956c25bU, 0x59f111f1U,
    0x923f82a4U, 0xab1c5ed5U, 0xd807aa98U, 0x12835b01U, 0x243185beU, 0x550c7dc3U,
    0x72be5d74U, 0x80deb1feU, 0x9bdc06a7U, 0xc19bf174U, 0xe49b69c1U, 0xefbe4786U,
    0x0fc19dc6U, 0x240ca1ccU, 0x2de92c6fU, 0x4a7484aaU, 0x5cb0a9dcU, 0x76f988daU,
    0x983e5152U, 0xa831c66dU, 0xb00327c8U, 0xbf597fc7U, 0xc6e00bf3U, 0xd5a79147U,
    0x06ca6351U, 0x14292967U, 0x27b70a85U, 0x2e1b2138U, 0x4d2c6dfcU, 0x53380d13U,
    0x650a7354U, 0x766a0abbU, 0x81c2c92eU, 0x92722c85U, 0xa2bfe8a1U, 0xa81a664bU,
    0xc24b8b70U, 0xc76c51a3U, 0xd192e819U, 0xd6990624U, 0xf40e3585U, 0x106aa070U,
    0x19a4c116U, 0x1e376c08U, 0x2748774cU, 0x34b0bcb5U, 0x391c0cb3U, 0x4ed8aa4aU,
    0x5b9cca4fU, 0x682e6ff3U, 0x748f82eeU, 0x78a5636fU, 0x84c87814U, 0x8cc70208U,
    0x90befffaU, 0xa4506cebU, 0xbef9a3f7U, 0xc67178f2U};

[[nodiscard]] constexpr std::uint32_t rotate_right(std::uint32_t value,
                                                    std::uint32_t amount) noexcept {
  return (value >> amount) | (value << (32U - amount));
}

class Sha256 final {
 public:
  Sha256() noexcept
      : state_{0x6a09e667U, 0xbb67ae85U, 0x3c6ef372U, 0xa54ff53aU,
               0x510e527fU, 0x9b05688cU, 0x1f83d9abU, 0x5be0cd19U} {}

  void update(const std::uint8_t* bytes, std::size_t length) noexcept {
    total_bytes_ += static_cast<std::uint64_t>(length);
    while (length > 0U) {
      const std::size_t amount = std::min(length, block_.size() - block_size_);
      std::memcpy(block_.data() + block_size_, bytes, amount);
      block_size_ += amount;
      bytes += amount;
      length -= amount;
      if (block_size_ == block_.size()) {
        transform(block_.data());
        block_size_ = 0U;
      }
    }
  }

  [[nodiscard]] std::array<std::uint8_t, 32> finish() noexcept {
    const std::uint64_t total_bits = total_bytes_ * 8ULL;
    block_[block_size_++] = 0x80U;
    if (block_size_ > 56U) {
      std::fill(block_.begin() + static_cast<std::ptrdiff_t>(block_size_), block_.end(), 0U);
      transform(block_.data());
      block_size_ = 0U;
    }
    std::fill(block_.begin() + static_cast<std::ptrdiff_t>(block_size_), block_.begin() + 56, 0U);
    for (std::size_t index = 0; index < 8U; ++index) {
      block_[63U - index] = static_cast<std::uint8_t>(total_bits >> (index * 8U));
    }
    transform(block_.data());
    std::array<std::uint8_t, 32> digest{};
    for (std::size_t index = 0; index < state_.size(); ++index) {
      digest[index * 4U] = static_cast<std::uint8_t>(state_[index] >> 24U);
      digest[index * 4U + 1U] = static_cast<std::uint8_t>(state_[index] >> 16U);
      digest[index * 4U + 2U] = static_cast<std::uint8_t>(state_[index] >> 8U);
      digest[index * 4U + 3U] = static_cast<std::uint8_t>(state_[index]);
    }
    return digest;
  }

 private:
  void transform(const std::uint8_t* block) noexcept {
    std::uint32_t words[64]{};
    for (std::size_t index = 0; index < 16U; ++index) {
      const std::size_t offset = index * 4U;
      words[index] = (static_cast<std::uint32_t>(block[offset]) << 24U) |
                     (static_cast<std::uint32_t>(block[offset + 1U]) << 16U) |
                     (static_cast<std::uint32_t>(block[offset + 2U]) << 8U) |
                     static_cast<std::uint32_t>(block[offset + 3U]);
    }
    for (std::size_t index = 16U; index < 64U; ++index) {
      const std::uint32_t s0 = rotate_right(words[index - 15U], 7U) ^
                               rotate_right(words[index - 15U], 18U) ^
                               (words[index - 15U] >> 3U);
      const std::uint32_t s1 = rotate_right(words[index - 2U], 17U) ^
                               rotate_right(words[index - 2U], 19U) ^
                               (words[index - 2U] >> 10U);
      words[index] = words[index - 16U] + s0 + words[index - 7U] + s1;
    }

    std::uint32_t a = state_[0];
    std::uint32_t b = state_[1];
    std::uint32_t c = state_[2];
    std::uint32_t d = state_[3];
    std::uint32_t e = state_[4];
    std::uint32_t f = state_[5];
    std::uint32_t g = state_[6];
    std::uint32_t h = state_[7];
    for (std::size_t index = 0; index < 64U; ++index) {
      const std::uint32_t sum1 = rotate_right(e, 6U) ^ rotate_right(e, 11U) ^ rotate_right(e, 25U);
      const std::uint32_t choice = (e & f) ^ ((~e) & g);
      const std::uint32_t temp1 = h + sum1 + choice + kSha256RoundConstants[index] + words[index];
      const std::uint32_t sum0 = rotate_right(a, 2U) ^ rotate_right(a, 13U) ^ rotate_right(a, 22U);
      const std::uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
      const std::uint32_t temp2 = sum0 + majority;
      h = g;
      g = f;
      f = e;
      e = d + temp1;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2;
    }
    state_[0] += a;
    state_[1] += b;
    state_[2] += c;
    state_[3] += d;
    state_[4] += e;
    state_[5] += f;
    state_[6] += g;
    state_[7] += h;
  }

  std::array<std::uint32_t, 8> state_;
  std::array<std::uint8_t, 64> block_{};
  std::size_t block_size_{};
  std::uint64_t total_bytes_{};
};

[[nodiscard]] std::string sha256_hex(const std::array<std::uint8_t, 32>& digest) {
  constexpr char kHex[] = "0123456789abcdef";
  std::string result("sha256:");
  result.resize(7U + digest.size() * 2U);
  for (std::size_t index = 0; index < digest.size(); ++index) {
    result[7U + index * 2U] = kHex[digest[index] >> 4U];
    result[8U + index * 2U] = kHex[digest[index] & 0x0fU];
  }
  return result;
}

class CborHashWriter final {
 public:
  void byte(std::uint8_t value) noexcept { append(&value, 1U); }

  void bytes(const std::uint8_t* values, std::size_t length) noexcept { append(values, length); }

  void unsigned_integer(std::uint64_t value) noexcept { major(0U, value); }

  void signed_integer(std::int64_t value) noexcept {
    if (value >= 0) {
      major(0U, static_cast<std::uint64_t>(value));
    } else {
      major(1U, static_cast<std::uint64_t>(-(value + 1)));
    }
  }

  void array(std::uint64_t length) noexcept { major(4U, length); }

  void map(std::uint64_t length) noexcept { major(5U, length); }

  void text(std::string_view value) noexcept {
    major(3U, static_cast<std::uint64_t>(value.size()));
    append(reinterpret_cast<const std::uint8_t*>(value.data()), value.size());
  }

  void byte_string(const std::uint8_t* value, std::size_t length) noexcept {
    major(2U, static_cast<std::uint64_t>(length));
    append(value, length);
  }

  [[nodiscard]] bool f64(double value) noexcept {
    if (!std::isfinite(value)) return false;
    const std::uint64_t bits = std::bit_cast<std::uint64_t>(value);
    std::array<std::uint8_t, 14> token{0x82U, 0x63U, 0x66U, 0x36U, 0x34U, 0x48U};
    for (std::size_t index = 0; index < 8U; ++index) {
      token[6U + index] = static_cast<std::uint8_t>(bits >> ((7U - index) * 8U));
    }
    append(token.data(), token.size());
    return true;
  }

  [[nodiscard]] std::string finish() {
    flush();
    return sha256_hex(hash_.finish());
  }

 private:
  void major(std::uint8_t type, std::uint64_t value) noexcept {
    if (value < 24ULL) {
      byte(static_cast<std::uint8_t>((type << 5U) | static_cast<std::uint8_t>(value)));
    } else if (value <= 0xffULL) {
      const std::uint8_t out[]{static_cast<std::uint8_t>((type << 5U) | 24U),
                               static_cast<std::uint8_t>(value)};
      append(out, sizeof(out));
    } else if (value <= 0xffffULL) {
      const std::uint8_t out[]{static_cast<std::uint8_t>((type << 5U) | 25U),
                               static_cast<std::uint8_t>(value >> 8U),
                               static_cast<std::uint8_t>(value)};
      append(out, sizeof(out));
    } else if (value <= 0xffffffffULL) {
      const std::uint8_t out[]{static_cast<std::uint8_t>((type << 5U) | 26U),
                               static_cast<std::uint8_t>(value >> 24U),
                               static_cast<std::uint8_t>(value >> 16U),
                               static_cast<std::uint8_t>(value >> 8U),
                               static_cast<std::uint8_t>(value)};
      append(out, sizeof(out));
    } else {
      std::array<std::uint8_t, 9> out{};
      out[0] = static_cast<std::uint8_t>((type << 5U) | 27U);
      for (std::size_t index = 0; index < 8U; ++index) {
        out[index + 1U] = static_cast<std::uint8_t>(value >> ((7U - index) * 8U));
      }
      append(out.data(), out.size());
    }
  }

  void append(const std::uint8_t* values, std::size_t length) noexcept {
    while (length > 0U) {
      const std::size_t amount = std::min(length, buffer_.size() - used_);
      std::memcpy(buffer_.data() + used_, values, amount);
      used_ += amount;
      values += amount;
      length -= amount;
      if (used_ == buffer_.size()) flush();
    }
  }

  void flush() noexcept {
    if (used_ == 0U) return;
    hash_.update(buffer_.data(), used_);
    used_ = 0U;
  }

  Sha256 hash_;
  std::array<std::uint8_t, 65536> buffer_{};
  std::size_t used_{};
};

[[nodiscard]] std::vector<std::uint8_t> encoded_text_key(std::string_view key) {
  std::vector<std::uint8_t> result;
  const std::size_t size = key.size();
  if (size < 24U) {
    result.push_back(static_cast<std::uint8_t>(0x60U + size));
  } else if (size <= 0xffU) {
    result.push_back(0x78U);
    result.push_back(static_cast<std::uint8_t>(size));
  } else {
    result.push_back(0x79U);
    result.push_back(static_cast<std::uint8_t>(size >> 8U));
    result.push_back(static_cast<std::uint8_t>(size));
  }
  result.insert(result.end(), key.begin(), key.end());
  return result;
}

struct CborMapMember final {
  std::string_view key;
  std::function<void(CborHashWriter&)> write_value;
};

void write_map(CborHashWriter& writer, std::vector<CborMapMember> members) {
  std::sort(members.begin(), members.end(), [](const CborMapMember& left, const CborMapMember& right) {
    const auto left_key = encoded_text_key(left.key);
    const auto right_key = encoded_text_key(right.key);
    if (left_key.size() != right_key.size()) return left_key.size() < right_key.size();
    return left_key < right_key;
  });
  writer.map(static_cast<std::uint64_t>(members.size()));
  for (const auto& member : members) {
    writer.text(member.key);
    member.write_value(writer);
  }
}

void write_vec3(CborHashWriter& writer, const Vec3& point) {
  writer.array(3U);
  (void)writer.f64(point.x);
  (void)writer.f64(point.y);
  (void)writer.f64(point.z);
}

void write_field_geometry(CborHashWriter& writer, const ScoringFieldGeometry& geometry) {
  std::vector<CborMapMember> members;
  members.reserve(7U);
  members.push_back({"coordinateUnits", [](CborHashWriter& out) { out.text("ANGSTROM"); }});
  members.push_back({"dimensions", [&geometry](CborHashWriter& out) {
                       out.array(3U);
                       for (const std::uint32_t point_count : geometry.point_counts) {
                         out.unsigned_integer(point_count);
                       }
                     }});
  members.push_back({"domainMaximum", [&geometry](CborHashWriter& out) {
                       write_vec3(out, geometry.domain_maximum);
                     }});
  members.push_back({"origin", [&geometry](CborHashWriter& out) { write_vec3(out, geometry.origin); }});
  members.push_back({"searchRegionBounds", [&geometry](CborHashWriter& out) {
                       out.array(2U);
                       write_vec3(out, geometry.search_region.minimum);
                       write_vec3(out, geometry.search_region.maximum);
                     }});
  members.push_back({"spacingAngstrom", [&geometry](CborHashWriter& out) {
                       (void)out.f64(geometry.spacing_angstrom);
                     }});
  write_map(writer, std::move(members));
}

[[nodiscard]] bool valid_digest(const std::string& value) noexcept {
  return value.size() == 71U && value.compare(0U, 7U, "sha256:") == 0 &&
         value.find_first_not_of("0123456789abcdef", 7U) == std::string::npos;
}

[[nodiscard]] bool valid_dependencies(const ScoringFieldDependencies& value) noexcept {
  return value.receptor_profile_id == kReceptorProfileId &&
         value.scoring_profile_id == kScoringProfileId &&
         value.typing_profile_id == kTypingProfileId &&
         value.chemistry_profile_id == kChemistryProfileId &&
         value.numerical_backend_profile_id == kBackendProfileId &&
         valid_digest(value.receptor_state_digest) &&
         valid_digest(value.receptor_typing_assignment_digest) &&
         valid_digest(value.search_region_digest) &&
         valid_digest(value.scoring_profile_digest) &&
         valid_digest(value.typing_profile_digest) &&
         valid_digest(value.chemistry_profile_digest) &&
         valid_digest(value.numerical_backend_profile_digest);
}

[[nodiscard]] bool runtime_rounding_supported() noexcept {
  if (std::fegetround() != FE_TONEAREST) return false;
#if defined(__SSE__)
  constexpr unsigned kFlushToZero = 1U << 15U;
  constexpr unsigned kDenormalsAreZero = 1U << 6U;
  if ((_mm_getcsr() & (kFlushToZero | kDenormalsAreZero)) != 0U) return false;
#endif
  return true;
}

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

[[nodiscard]] std::optional<std::size_t> xs_id(std::string_view type) noexcept {
  for (std::size_t id = 0; id < kCanonicalXsTypes.size(); ++id) {
    if (kCanonicalXsTypes[id] == type) return id;
  }
  return std::nullopt;
}

[[nodiscard]] bool finite_vec3(const Vec3& value) noexcept {
  return std::isfinite(value.x) && std::isfinite(value.y) && std::isfinite(value.z);
}

[[nodiscard]] double axis_value(double origin, double spacing, std::size_t index) noexcept {
  return origin + static_cast<double>(index) * spacing;
}

[[nodiscard]] bool derive_geometry(const AxisAlignedBox& search_region,
                                   ScoringFieldGeometry* geometry) noexcept {
  if (geometry == nullptr || !finite_vec3(search_region.minimum) || !finite_vec3(search_region.maximum)) {
    return false;
  }
  const std::array<double, 3> minimum{search_region.minimum.x, search_region.minimum.y,
                                     search_region.minimum.z};
  const std::array<double, 3> maximum{search_region.maximum.x, search_region.maximum.y,
                                     search_region.maximum.z};
  std::array<double, 3> origin{};
  std::array<double, 3> domain_max{};
  std::array<std::uint32_t, 3> counts{};
  double search_volume = 1.0;
  for (std::size_t axis = 0; axis < 3U; ++axis) {
    if (!(minimum[axis] < maximum[axis])) return false;
    const double extent = maximum[axis] - minimum[axis];
    if (!std::isfinite(extent) || extent > 40.0) return false;
    search_volume *= extent;
    const double cells = std::ceil((extent + 2.0 * kScoringFieldGridSpacingAngstrom) /
                                   kScoringFieldGridSpacingAngstrom);
    if (!std::isfinite(cells) || cells < 1.0 || cells > 109.0) return false;
    counts[axis] = static_cast<std::uint32_t>(cells) + 1U;
    origin[axis] = minimum[axis] - kScoringFieldGridSpacingAngstrom;
    domain_max[axis] = origin[axis] + cells * kScoringFieldGridSpacingAngstrom;
    if (!std::isfinite(origin[axis]) || !std::isfinite(domain_max[axis])) return false;
    if (!(axis_value(origin[axis], kScoringFieldGridSpacingAngstrom, 1U) > origin[axis])) return false;
    if (!(domain_max[axis] > axis_value(origin[axis], kScoringFieldGridSpacingAngstrom,
                                        static_cast<std::size_t>(counts[axis]) - 2U))) {
      return false;
    }
  }
  if (!(search_volume > 0.0) || !std::isfinite(search_volume) || search_volume > 64000.0) return false;
  const std::uint64_t points = static_cast<std::uint64_t>(counts[0]) * counts[1] * counts[2];
  if (points == 0U || points > static_cast<std::uint64_t>(kScoringFieldMaxAxisPoints) *
                                    kScoringFieldMaxAxisPoints * kScoringFieldMaxAxisPoints) {
    return false;
  }
  geometry->search_region = search_region;
  geometry->origin = Vec3{origin[0], origin[1], origin[2]};
  geometry->domain_maximum = Vec3{domain_max[0], domain_max[1], domain_max[2]};
  geometry->spacing_angstrom = kScoringFieldGridSpacingAngstrom;
  geometry->point_counts = counts;
  geometry->total_point_count = static_cast<std::size_t>(points);
  return true;
}

[[nodiscard]] bool valid_receptor_atoms(const std::vector<Atom>& atoms,
                                        std::vector<const Atom*>* sorted,
                                        std::string* code,
                                        std::string* message) {
  if (atoms.empty()) {
    *code = "SCORING_FIELD_BUILD_FAILED";
    *message = "The prepared receptor atom set is empty.";
    return false;
  }
  sorted->reserve(atoms.size());
  for (const Atom& atom : atoms) sorted->push_back(&atom);
  std::sort(sorted->begin(), sorted->end(), [](const Atom* left, const Atom* right) {
    return left->atom_uid < right->atom_uid;
  });
  std::size_t scoring_count = 0U;
  for (std::size_t index = 0; index < sorted->size(); ++index) {
    const Atom& atom = *(*sorted)[index];
    if (atom.atom_uid.empty() || (index > 0U && (*sorted)[index - 1U]->atom_uid == atom.atom_uid)) {
      *code = "SCORING_FIELD_BUILD_FAILED";
      *message = "Receptor AtomUID values must be unique and nonempty.";
      return false;
    }
    if (!finite_vec3(atom.position)) {
      *code = "SCORING_FIELD_NONFINITE";
      *message = "A receptor coordinate is not finite.";
      return false;
    }
    if (!atom.scoring_center) {
      if (atom.element != "H" || !atom.xs_type.empty()) {
        *code = "SCORING_ATOM_TYPE_UNSUPPORTED";
        *message = "Only explicit hydrogen helpers may be excluded from receptor scoring centers.";
        return false;
      }
      continue;
    }
    ++scoring_count;
    if (!xs_radius(atom.xs_type) || !xs_element_matches(atom.xs_type, atom.element)) {
      *code = "SCORING_ATOM_TYPE_UNSUPPORTED";
      *message = "A receptor scoring center has no supported element-compatible XS type.";
      return false;
    }
  }
  if (scoring_count == 0U || scoring_count > kScoringFieldMaxReceptorAtoms) {
    *code = "SCORING_FIELD_BUILD_FAILED";
    *message = "The receptor scoring-center count is outside the ordinary-V1 limit.";
    return false;
  }
  return true;
}

struct Candidate final {
  std::uint32_t stable_index{};
  double distance{};
};

struct BoundingBox final {
  Vec3 minimum{std::numeric_limits<double>::infinity(), std::numeric_limits<double>::infinity(),
               std::numeric_limits<double>::infinity()};
  Vec3 maximum{-std::numeric_limits<double>::infinity(), -std::numeric_limits<double>::infinity(),
               -std::numeric_limits<double>::infinity()};
};

struct BvhNode final {
  BoundingBox bounds;
  std::uint32_t left{std::numeric_limits<std::uint32_t>::max()};
  std::uint32_t right{std::numeric_limits<std::uint32_t>::max()};
  std::uint32_t begin{};
  std::uint32_t count{};
};

[[nodiscard]] bool distance_to_box(const Vec3& point, const BoundingBox& box,
                                   double* distance) noexcept {
  const auto axis_distance = [](double value, double minimum, double maximum) noexcept {
    if (value < minimum) return minimum - value;
    if (value > maximum) return value - maximum;
    return 0.0;
  };
  const double dx = axis_distance(point.x, box.minimum.x, box.maximum.x);
  const double dy = axis_distance(point.y, box.minimum.y, box.maximum.y);
  const double dz = axis_distance(point.z, box.minimum.z, box.maximum.z);
  *distance = std::hypot(std::hypot(dx, dy), dz);
  return std::isfinite(*distance);
}

class ReceptorBvh final {
 public:
  bool build(const std::vector<const Atom*>& stable_atoms) {
    stable_atoms_ = &stable_atoms;
    order_.resize(stable_atoms.size());
    std::iota(order_.begin(), order_.end(), 0U);
    const std::size_t leaves = (stable_atoms.size() + kLeafSize - 1U) / kLeafSize;
    nodes_.reserve(leaves == 0U ? 0U : leaves * 2U - 1U);
    if (!stable_atoms.empty()) (void)build_range(0U, static_cast<std::uint32_t>(stable_atoms.size()));
    return !nodes_.empty();
  }

  [[nodiscard]] bool query(const Vec3& point, std::vector<Candidate>* candidates) const {
    candidates->clear();
    if (nodes_.empty()) return true;
    std::array<std::uint32_t, 128> inline_stack{};
    std::vector<std::uint32_t> overflow_stack;
    std::size_t stack_size = 1U;
    inline_stack[0] = 0U;
    while (stack_size > 0U) {
      std::uint32_t node_id{};
      if (!overflow_stack.empty()) {
        node_id = overflow_stack.back();
        overflow_stack.pop_back();
      } else {
        node_id = inline_stack[--stack_size];
      }
      const BvhNode& node = nodes_[node_id];
      double box_distance{};
      if (!distance_to_box(point, node.bounds, &box_distance)) continue;
      if (!(box_distance < kPhysicalCutoffAngstrom)) continue;
      if (node.count > 0U) {
        for (std::uint32_t offset = 0U; offset < node.count; ++offset) {
          const std::uint32_t stable_index = order_[node.begin + offset];
          const Atom& atom = *(*stable_atoms_)[stable_index];
          if (!atom.scoring_center) continue;
          const double dx = atom.position.x - point.x;
          const double dy = atom.position.y - point.y;
          const double dz = atom.position.z - point.z;
          const double distance = std::hypot(std::hypot(dx, dy), dz);
          if (!std::isfinite(distance)) return false;
          if (distance < kPhysicalCutoffAngstrom) {
            candidates->push_back(Candidate{stable_index, distance});
          }
        }
      } else {
        if (stack_size + 2U <= inline_stack.size() && overflow_stack.empty()) {
          inline_stack[stack_size++] = node.right;
          inline_stack[stack_size++] = node.left;
        } else {
          overflow_stack.push_back(node.right);
          overflow_stack.push_back(node.left);
        }
      }
    }
    std::sort(candidates->begin(), candidates->end(), [](const Candidate& left, const Candidate& right) {
      return left.stable_index < right.stable_index;
    });
    return true;
  }

  [[nodiscard]] std::uint64_t allocated_bytes() const noexcept {
    return static_cast<std::uint64_t>(order_.capacity()) * sizeof(std::uint32_t) +
           static_cast<std::uint64_t>(nodes_.capacity()) * sizeof(BvhNode);
  }

 private:
  static constexpr std::uint32_t kLeafSize = 16U;

  [[nodiscard]] BoundingBox bounds_for(std::uint32_t begin, std::uint32_t end) const noexcept {
    BoundingBox bounds;
    for (std::uint32_t index = begin; index < end; ++index) {
      const Vec3& position = (*stable_atoms_)[order_[index]]->position;
      bounds.minimum.x = std::min(bounds.minimum.x, position.x);
      bounds.minimum.y = std::min(bounds.minimum.y, position.y);
      bounds.minimum.z = std::min(bounds.minimum.z, position.z);
      bounds.maximum.x = std::max(bounds.maximum.x, position.x);
      bounds.maximum.y = std::max(bounds.maximum.y, position.y);
      bounds.maximum.z = std::max(bounds.maximum.z, position.z);
    }
    return bounds;
  }

  [[nodiscard]] std::uint32_t build_range(std::uint32_t begin, std::uint32_t end) {
    const std::uint32_t node_id = static_cast<std::uint32_t>(nodes_.size());
    nodes_.push_back(BvhNode{});
    BvhNode node;
    node.bounds = bounds_for(begin, end);
    const std::uint32_t count = end - begin;
    if (count <= kLeafSize) {
      node.begin = begin;
      node.count = count;
      nodes_[node_id] = node;
      return node_id;
    }
    const double ranges[3]{node.bounds.maximum.x - node.bounds.minimum.x,
                           node.bounds.maximum.y - node.bounds.minimum.y,
                           node.bounds.maximum.z - node.bounds.minimum.z};
    std::size_t axis = 0U;
    if (ranges[1] > ranges[axis]) axis = 1U;
    if (ranges[2] > ranges[axis]) axis = 2U;
    const std::uint32_t middle = begin + count / 2U;
    std::nth_element(order_.begin() + begin, order_.begin() + middle, order_.begin() + end,
                     [this, axis](std::uint32_t left, std::uint32_t right) {
                       const Vec3& a = (*stable_atoms_)[left]->position;
                       const Vec3& b = (*stable_atoms_)[right]->position;
                       const double av = axis == 0U ? a.x : (axis == 1U ? a.y : a.z);
                       const double bv = axis == 0U ? b.x : (axis == 1U ? b.y : b.z);
                       if (av != bv) return av < bv;
                       return (*stable_atoms_)[left]->atom_uid < (*stable_atoms_)[right]->atom_uid;
                     });
    node.left = build_range(begin, middle);
    node.right = build_range(middle, end);
    nodes_[node_id] = node;
    return node_id;
  }

  const std::vector<const Atom*>* stable_atoms_{};
  std::vector<std::uint32_t> order_;
  std::vector<BvhNode> nodes_;
};

[[nodiscard]] std::size_t dynamic_string_bytes(const std::string& value) noexcept {
  static const std::size_t inline_capacity = std::string{}.capacity();
  return value.capacity() > inline_capacity ? value.capacity() + 1U : 0U;
}

[[nodiscard]] std::uint64_t field_metadata_allocation_bytes(const ScoringField& field) noexcept {
  const ScoringFieldDependencies& dependencies = field.dependencies();
  const ScoringFieldStorageIdentity& storage = field.storage_identity();
  const std::string* strings[]{
      &dependencies.receptor_state_digest, &dependencies.receptor_typing_assignment_digest,
      &dependencies.search_region_digest, &dependencies.receptor_profile_id,
      &dependencies.scoring_profile_id, &dependencies.scoring_profile_digest,
      &dependencies.typing_profile_id, &dependencies.typing_profile_digest,
      &dependencies.chemistry_profile_id, &dependencies.chemistry_profile_digest,
      &dependencies.numerical_backend_profile_id, &dependencies.numerical_backend_profile_digest,
      &field.logical_digest(), &storage.logical_digest, &storage.schema_id,
      &storage.physical_layout_id, &storage.numeric_representation,
      &storage.physical_payload_digest, &storage.identity_digest};
  std::uint64_t total = 0U;
  for (const std::string* value : strings) total += dynamic_string_bytes(*value);
  return total;
}

[[nodiscard]] std::string compute_physical_payload_digest(const ScoringField& field) {
  Sha256 hash;
  std::array<std::uint8_t, 65536> buffer{};
  std::size_t used = 0U;
  const auto flush = [&hash, &buffer, &used]() noexcept {
    if (used > 0U) {
      hash.update(buffer.data(), used);
      used = 0U;
    }
  };
  for (std::size_t physical = 0; physical < kPhysicalChannelCount; ++physical) {
    for (const double value : field.physical_channel_values(physical)) {
      const std::uint64_t bits = std::bit_cast<std::uint64_t>(value);
      for (std::size_t byte_index = 0; byte_index < 8U; ++byte_index) {
        buffer[used++] = static_cast<std::uint8_t>(bits >> ((7U - byte_index) * 8U));
        if (used == buffer.size()) flush();
      }
    }
  }
  flush();
  return sha256_hex(hash.finish());
}

[[nodiscard]] std::string compute_storage_identity_digest(
    const ScoringFieldStorageIdentity& identity) {
  CborHashWriter writer;
  writer.array(6U);
  writer.text("ME-PHDV2-DIGEST");
  writer.unsigned_integer(1U);
  writer.text("SCORING_FIELD_STORAGE");
  writer.text(kScoringFieldStorageSchemaId);
  writer.text(kScoringFieldCanonicalizationProfile);
  writer.map(7U);
  writer.text("mapping");
  writer.array(kLogicalChannelCount);
  for (const std::int16_t ordinal : kLogicalToPhysicalChannel) writer.signed_integer(ordinal);
  writer.text("schemaId");
  writer.text(identity.schema_id);
  writer.text("logicalDigest");
  writer.text(identity.logical_digest);
  writer.text("physicalLayoutId");
  writer.text(identity.physical_layout_id);
  writer.text("physicalArrayCount");
  writer.unsigned_integer(kPhysicalChannelCount);
  writer.text("numericRepresentation");
  writer.text(identity.numeric_representation);
  writer.text("physicalPayloadDigest");
  writer.text(identity.physical_payload_digest);
  return writer.finish();
}

[[nodiscard]] bool field_runtime_valid(const ScoringField& field) noexcept {
  if (!field.valid()) return false;
  for (std::size_t physical = 0; physical < kPhysicalChannelCount; ++physical) {
    if (field.physical_channel_values(physical).size() != field.geometry().total_point_count) return false;
  }
  for (std::size_t logical = 0; logical < kLogicalChannelCount; ++logical) {
    if (physical_channel_ordinal(logical)) continue;
    const std::size_t xs = logical / kTermCount;
    const std::size_t term = logical % kTermCount;
    if (logical_channel_is_physical(xs * kTermCount + term)) return false;
  }
  return true;
}

[[nodiscard]] bool axis_cell(double coordinate, double origin, double spacing,
                             std::size_t point_count, std::size_t* lower,
                             double* fraction) noexcept {
  if (point_count < 2U || lower == nullptr || fraction == nullptr) return false;
  std::size_t lo = 0U;
  std::size_t hi = point_count;
  while (lo < hi) {
    const std::size_t middle = lo + (hi - lo) / 2U;
    const double node = axis_value(origin, spacing, middle);
    if (coordinate == node) {
      if (middle + 1U == point_count) {
        *lower = middle - 1U;
        *fraction = 1.0;
      } else {
        *lower = middle;
        *fraction = 0.0;
      }
      return true;
    }
    if (coordinate < node) hi = middle;
    else lo = middle + 1U;
  }
  if (lo == 0U || lo >= point_count) return false;
  *lower = lo - 1U;
  const double node = axis_value(origin, spacing, *lower);
  *fraction = (coordinate - node) / spacing;
  return *fraction >= 0.0 && *fraction <= 1.0 && std::isfinite(*fraction);
}

struct FieldReaderContext final {
  const ScoringField* field{};
};

[[nodiscard]] double field_reader(const void* context, std::size_t logical,
                                  std::size_t point) noexcept {
  const auto* reader = static_cast<const FieldReaderContext*>(context);
  const auto value = reader->field->logical_raw_value(logical, point);
  return value.value_or(std::numeric_limits<double>::quiet_NaN());
}

}  // namespace

std::string compute_logical_scoring_field_digest(const ScoringFieldLogicalIdentity& identity,
                                                 LogicalChannelValueReader reader,
                                                 const void* context) {
  if (reader == nullptr || identity.geometry.total_point_count == 0U ||
      !valid_dependencies(identity.dependencies)) return {};
  const ScoringFieldGeometry& geometry = identity.geometry;
  if (!finite_vec3(geometry.origin) || !finite_vec3(geometry.domain_maximum) ||
      !finite_vec3(geometry.search_region.minimum) || !finite_vec3(geometry.search_region.maximum) ||
      !std::isfinite(geometry.spacing_angstrom) || geometry.spacing_angstrom <= 0.0) return {};
  CborHashWriter writer;
  writer.array(6U);
  writer.text("ME-PHDV2-DIGEST");
  writer.unsigned_integer(1U);
  writer.text("SCORING_FIELD");
  writer.text(kScoringFieldLogicalSchemaId);
  writer.text(kScoringFieldCanonicalizationProfile);
  bool cbor_values_valid = true;
  std::vector<CborMapMember> members;
  members.reserve(17U);
  members.push_back({"canonicalizationProfile", [](CborHashWriter& out) {
                       out.text(kScoringFieldCanonicalizationProfile);
                     }});
  members.push_back({"chemistryProfileDigest", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.chemistry_profile_digest);
                     }});
  members.push_back({"chemistryProfileId", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.chemistry_profile_id);
                     }});
  members.push_back({"gridGeometry", [&geometry](CborHashWriter& out) {
                       write_field_geometry(out, geometry);
                     }});
  members.push_back({"gridProfileId", [](CborHashWriter& out) { out.text(kScoringFieldGridProfileId); }});
  members.push_back({"logicalChannels", [reader, context, points = geometry.total_point_count,
                                          &cbor_values_valid](CborHashWriter& out) {
                       out.array(kLogicalChannelCount);
                       for (std::size_t logical = 0; logical < kLogicalChannelCount; ++logical) {
                         const std::size_t xs = logical / kTermCount;
                         const std::size_t term = logical % kTermCount;
                         out.array(5U);
                         out.unsigned_integer(logical);
                         out.unsigned_integer(xs);
                         out.unsigned_integer(term);
                         out.text(kCanonicalXsTypes[xs]);
                         out.array(points);
                         if (!logical_channel_is_physical(logical)) {
                           for (std::size_t point = 0; point < points; ++point) {
                             (void)out.f64(0.0);
                           }
                         } else {
                           for (std::size_t point = 0; point < points; ++point) {
                             if (!out.f64(reader(context, logical, point))) {
                               cbor_values_valid = false;
                             }
                           }
                         }
                       }
                     }});
  members.push_back({"numericalBackendProfileDigest", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.numerical_backend_profile_digest);
                     }});
  members.push_back({"numericalBackendProfileId", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.numerical_backend_profile_id);
                     }});
  members.push_back({"receptorProfileId", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.receptor_profile_id);
                     }});
  members.push_back({"receptorStateDigest", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.receptor_state_digest);
                     }});
  members.push_back({"receptorTypingAssignmentDigest", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.receptor_typing_assignment_digest);
                     }});
  members.push_back({"scoringProfileDigest", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.scoring_profile_digest);
                     }});
  members.push_back({"scoringProfileId", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.scoring_profile_id);
                     }});
  members.push_back({"searchRegionDigest", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.search_region_digest);
                     }});
  members.push_back({"semanticSchemaId", [](CborHashWriter& out) {
                       out.text(kScoringFieldLogicalSchemaId);
                     }});
  members.push_back({"typingProfileDigest", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.typing_profile_digest);
                     }});
  members.push_back({"typingProfileId", [&identity](CborHashWriter& out) {
                       out.text(identity.dependencies.typing_profile_id);
                     }});
  write_map(writer, std::move(members));
  if (!cbor_values_valid) return {};
  return writer.finish();
}

bool scoring_field_cache_compatible(const ScoringFieldStorageIdentity& cached,
                                   const ScoringFieldStorageIdentity& required) noexcept {
  if (!valid_digest(cached.logical_digest) || !valid_digest(required.logical_digest) ||
      cached.logical_digest != required.logical_digest ||
      cached.schema_id != required.schema_id || cached.schema_id != kScoringFieldStorageSchemaId ||
      cached.physical_layout_id != required.physical_layout_id ||
      cached.physical_layout_id != kScoringFieldPhysicalLayoutId ||
      cached.numeric_representation != required.numeric_representation ||
      cached.numeric_representation != "IEEE754_BINARY64_BIG_ENDIAN_BITS" ||
      !valid_digest(cached.physical_payload_digest) || !validate_scoring_field_storage_identity(cached) ||
      (!required.identity_digest.empty() && !validate_scoring_field_storage_identity(required))) {
    return false;
  }
  return required.physical_payload_digest.empty() ||
         cached.physical_payload_digest == required.physical_payload_digest;
}

bool validate_scoring_field_storage_identity(const ScoringFieldStorageIdentity& identity) noexcept {
  if (!valid_digest(identity.logical_digest) || !valid_digest(identity.physical_payload_digest) ||
      identity.schema_id != kScoringFieldStorageSchemaId ||
      identity.physical_layout_id != kScoringFieldPhysicalLayoutId ||
      identity.numeric_representation != "IEEE754_BINARY64_BIG_ENDIAN_BITS" ||
      !valid_digest(identity.identity_digest)) return false;
  try {
    return compute_storage_identity_digest(identity) == identity.identity_digest;
  } catch (...) {
    return false;
  }
}

std::span<const double> ScoringField::physical_channel_values(std::size_t physical_ordinal) const noexcept {
  if (physical_ordinal >= kPhysicalChannelCount || !physical_channels_[physical_ordinal]) return {};
  return {physical_channels_[physical_ordinal].get(), geometry_.total_point_count};
}

std::optional<double> ScoringField::logical_raw_value(std::size_t logical_channel,
                                                      std::size_t point_index) const noexcept {
  if (logical_channel >= kLogicalChannelCount || point_index >= geometry_.total_point_count) return std::nullopt;
  const auto ordinal = physical_channel_ordinal(logical_channel);
  if (!ordinal) return 0.0;
  if (!physical_channels_[*ordinal]) return std::nullopt;
  return physical_channels_[*ordinal][point_index];
}

ScoringFieldSample ScoringField::interpolate(std::string_view ligand_xs_type,
                                             const Vec3& coordinate) const noexcept {
  ScoringFieldSample sample;
  if (!field_runtime_valid(*this) || !finite_vec3(coordinate)) {
    sample.status = ScoringFieldStatus::InvalidField;
    return sample;
  }
  const auto ligand_xs = xs_id(ligand_xs_type);
  if (!ligand_xs) {
    sample.status = ScoringFieldStatus::ChannelMissing;
    return sample;
  }
  std::size_t lower[3]{};
  double fraction[3]{};
  const double point[3]{coordinate.x, coordinate.y, coordinate.z};
  const double origin[3]{geometry_.origin.x, geometry_.origin.y, geometry_.origin.z};
  const double domain[3]{geometry_.domain_maximum.x, geometry_.domain_maximum.y,
                         geometry_.domain_maximum.z};
  for (std::size_t axis = 0; axis < 3U; ++axis) {
    if (point[axis] < origin[axis] || point[axis] > domain[axis] ||
        !axis_cell(point[axis], origin[axis], geometry_.spacing_angstrom,
                   geometry_.point_counts[axis], &lower[axis], &fraction[axis])) {
      sample.status = ScoringFieldStatus::OutOfDomain;
      return sample;
    }
  }

  for (std::size_t term = 0; term < kTermCount; ++term) {
    const std::size_t logical = logical_channel_id(*ligand_xs, term);
    double interpolated = 0.0;
    for (std::size_t a = 0; a < 2U; ++a) {
      const double wx = a == 0U ? 1.0 - fraction[0] : fraction[0];
      for (std::size_t b = 0; b < 2U; ++b) {
        const double wy = b == 0U ? 1.0 - fraction[1] : fraction[1];
        for (std::size_t c = 0; c < 2U; ++c) {
          const double wz = c == 0U ? 1.0 - fraction[2] : fraction[2];
          const std::size_t x = lower[0] + a;
          const std::size_t y = lower[1] + b;
          const std::size_t z = lower[2] + c;
          const std::size_t point_index =
              (x * geometry_.point_counts[1] + y) * geometry_.point_counts[2] + z;
          const auto value = logical_raw_value(logical, point_index);
          if (!value || !std::isfinite(*value)) {
            sample.status = ScoringFieldStatus::InvalidField;
            return sample;
          }
          const double weight = (wx * wy) * wz;
          interpolated += *value * weight;
        }
      }
    }
    if (!std::isfinite(interpolated)) {
      sample.status = ScoringFieldStatus::InvalidField;
      return sample;
    }
    sample.raw[term] = interpolated;
    sample.weighted[term] = interpolated * kScoringTermCoefficients[term];
  }
  NeumaierSum inter_score;
  for (const double weighted : sample.weighted) inter_score.add(weighted);
  sample.inter_score = inter_score.value();
  if (!std::isfinite(sample.inter_score)) {
    sample.status = ScoringFieldStatus::InvalidField;
    return sample;
  }
  sample.status = ScoringFieldStatus::Valid;
  return sample;
}

ScoringFieldBuildResult build_scoring_field(const ScoringFieldBuildRequest& request) try {
  ScoringFieldBuildResult result;
  const auto fail = [&result](std::string code, std::string message) {
    result.diagnostic_code = std::move(code);
    result.diagnostic = std::move(message);
  };
  if (request.site_class != SiteClass::DryCore) {
    fail("SCORING_UNSUPPORTED_SITE_CLASS", "The canonical grid profile requires the dry-core receptor profile.");
    return result;
  }
  if (request.coordinate_units != "ANGSTROM") {
    fail("INVALID_COORDINATE_UNITS", "Scoring-field coordinates must be expressed in Angstrom.");
    return result;
  }
  if (!request.site_influence_complete) {
    fail("SCORING_FIELD_BUILD_FAILED", "The prepared receptor lacks sealed site-influence completeness evidence.");
    return result;
  }
  if (!valid_dependencies(request.dependencies)) {
    fail("INVALID_PROVENANCE_DIGEST", "Scoring-field dependencies must use the canonical V1 profile IDs and SHA-256 references.");
    return result;
  }
  if (!runtime_rounding_supported()) {
    fail("UNSUPPORTED_FLOATING_POINT_ENVIRONMENT", "Field construction requires round-to-nearest and disabled FTZ/DAZ.");
    return result;
  }

  auto field = std::make_unique<ScoringField>();
  if (!derive_geometry(request.search_region, &field->geometry_)) {
    fail("SCORING_FIELD_BUILD_FAILED", "SearchRegion geometry is invalid or exceeds the canonical grid profile limits.");
    return result;
  }
  if (static_cast<std::uint64_t>(field->geometry_.total_point_count) * kPhysicalChannelCount * sizeof(double) >
      kScoringFieldMaxRawPayloadBytes) {
    fail("SCORING_FIELD_RESOURCE_REJECTED", "The physical field payload exceeds the 768 MiB raw-payload limit.");
    return result;
  }
  field->dependencies_ = request.dependencies;

  std::vector<const Atom*> receptor;
  std::string receptor_error_code;
  std::string receptor_error_message;
  if (!valid_receptor_atoms(request.receptor_atoms, &receptor,
                            &receptor_error_code, &receptor_error_message)) {
    fail(std::move(receptor_error_code), std::move(receptor_error_message));
    return result;
  }
  for (const Atom* atom : receptor) {
    const double delta_x = atom->position.x - field->geometry_.origin.x;
    const double delta_y = atom->position.y - field->geometry_.origin.y;
    const double delta_z = atom->position.z - field->geometry_.origin.z;
    if (!std::isfinite(delta_x) || !std::isfinite(delta_y) || !std::isfinite(delta_z)) {
      fail("SCORING_FIELD_NONFINITE", "A receptor coordinate overflows relative to the scoring-field frame.");
      return result;
    }
  }

  try {
    for (auto& channel : field->physical_channels_) {
      channel = std::make_unique<double[]>(field->geometry_.total_point_count);
    }
  } catch (const std::bad_alloc&) {
    fail("SCORING_FIELD_RESOURCE_REJECTED", "Physical field allocation failed within the configured resource policy.");
    return result;
  }

  ReceptorBvh bvh;
  try {
    if (!bvh.build(receptor)) {
      fail("SCORING_FIELD_BUILD_FAILED", "The receptor spatial index could not be constructed.");
      return result;
    }
  } catch (const std::bad_alloc&) {
    fail("SCORING_FIELD_RESOURCE_REJECTED", "Receptor spatial-index allocation failed.");
    return result;
  }

  std::vector<Candidate> candidates;
  candidates.reserve(std::min<std::size_t>(receptor.size(), 128U));
  std::array<std::array<NeumaierSum, kTermCount>, kCanonicalXsTypes.size()> accumulators{};
  bool build_ok = true;
  const std::size_t nx = field->geometry_.point_counts[0];
  const std::size_t ny = field->geometry_.point_counts[1];
  const std::size_t nz = field->geometry_.point_counts[2];
  for (std::size_t x = 0; x < nx && build_ok; ++x) {
    const double coordinate_x = axis_value(field->geometry_.origin.x,
                                           field->geometry_.spacing_angstrom, x);
    for (std::size_t y = 0; y < ny && build_ok; ++y) {
      const double coordinate_y = axis_value(field->geometry_.origin.y,
                                             field->geometry_.spacing_angstrom, y);
      for (std::size_t z = 0; z < nz && build_ok; ++z) {
        const double coordinate_z = axis_value(field->geometry_.origin.z,
                                               field->geometry_.spacing_angstrom, z);
        const Vec3 coordinate{coordinate_x, coordinate_y, coordinate_z};
        if (!bvh.query(coordinate, &candidates)) {
          build_ok = false;
          break;
        }
        for (auto& per_type : accumulators) {
          for (auto& term : per_type) term = NeumaierSum{};
        }
        for (const Candidate& candidate : candidates) {
          const Atom& receptor_atom = *receptor[candidate.stable_index];
          for (std::size_t xs = 0; xs < kCanonicalXsTypes.size(); ++xs) {
            const auto terms = score_pair_terms(receptor_atom.xs_type,
                                                kCanonicalXsTypes[xs], candidate.distance);
            if (!terms) {
              build_ok = false;
              break;
            }
            for (std::size_t term = 0; term < kTermCount; ++term) {
              const std::size_t logical = logical_channel_id(xs, term);
              if (logical_channel_is_physical(logical)) {
                accumulators[xs][term].add((*terms)[term]);
              }
            }
          }
          if (!build_ok) break;
        }
        const std::size_t point_index = (x * ny + y) * nz + z;
        for (std::size_t xs = 0; xs < kCanonicalXsTypes.size(); ++xs) {
          for (std::size_t term = 0; term < kTermCount; ++term) {
            const std::size_t logical = logical_channel_id(xs, term);
            const auto physical = physical_channel_ordinal(logical);
            if (physical) {
              const double value = accumulators[xs][term].value();
              if (!std::isfinite(value)) {
                build_ok = false;
                break;
              }
              field->physical_channels_[*physical][point_index] = value;
            }
          }
          if (!build_ok) break;
        }
      }
    }
  }
  if (!build_ok) {
    fail("SCORING_FIELD_NONFINITE", "A grid-node scoring interaction produced a nonfinite value.");
    return result;
  }

  ScoringFieldLogicalIdentity identity{field->dependencies_, field->geometry_};
  const FieldReaderContext reader_context{field.get()};
  field->logical_digest_ = compute_logical_scoring_field_digest(identity, field_reader, &reader_context);
  if (!valid_digest(field->logical_digest_)) {
    fail("SCORING_FIELD_NONFINITE", "Logical ScoringField canonicalization rejected a nonfinite raw value.");
    return result;
  }
  field->storage_identity_.logical_digest = field->logical_digest_;
  field->storage_identity_.physical_payload_digest = compute_physical_payload_digest(*field);
  field->storage_identity_.identity_digest = compute_storage_identity_digest(field->storage_identity_);

  const std::uint64_t raw_payload = static_cast<std::uint64_t>(field->geometry_.total_point_count) *
                                    kPhysicalChannelCount * sizeof(double);
  const std::uint64_t metadata_bytes = field_metadata_allocation_bytes(*field);
  const std::uint64_t retained_field = static_cast<std::uint64_t>(sizeof(ScoringField)) +
                                       raw_payload + metadata_bytes;
  const std::uint64_t scratch_bytes = static_cast<std::uint64_t>(receptor.capacity()) * sizeof(const Atom*) +
                                      bvh.allocated_bytes() +
                                      static_cast<std::uint64_t>(candidates.capacity()) * sizeof(Candidate);
  // Bounds the short-lived canonical-map member/key buffers while both the
  // field payload and receptor spatial index are live during identity sealing.
  constexpr std::uint64_t kCanonicalizationScratchAllowanceBytes = 64ULL * 1024ULL;
  const std::uint64_t field_owned = retained_field + scratch_bytes +
                                    kCanonicalizationScratchAllowanceBytes;
  const std::uint64_t construction_peak = field_owned;
  if (raw_payload > kScoringFieldMaxRawPayloadBytes ||
      field_owned > kScoringFieldMaxOwnedAllocationBytes ||
      construction_peak > kScoringFieldMaxOwnedAllocationBytes) {
    fail("SCORING_FIELD_RESOURCE_REJECTED", "The measured production field exceeds an approved allocation limit.");
    return result;
  }
  field->resource_usage_ = ScoringFieldResourceUsage{
      raw_payload,
      field_owned,
      retained_field,
      construction_peak,
      static_cast<std::uint64_t>(field->geometry_.total_point_count),
      static_cast<std::uint32_t>(std::count_if(receptor.begin(), receptor.end(),
                                               [](const Atom* atom) { return atom->scoring_center; }))};
  result.valid = true;
  result.field = std::move(field);
  return result;
} catch (const std::bad_alloc&) {
  return ScoringFieldBuildResult{false, "SCORING_FIELD_RESOURCE_REJECTED",
                                 "A scoring-field allocation failed.", nullptr};
} catch (...) {
  return ScoringFieldBuildResult{false, "SCORING_FIELD_BUILD_FAILED",
                                 "Scoring-field construction failed safely.", nullptr};
}

}  // namespace mole::docking
