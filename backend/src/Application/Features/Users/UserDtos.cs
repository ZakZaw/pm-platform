namespace Application.Features.Users;

public record UserProfileDto(
    Guid Id,
    string Email,
    string FullName,
    string? AvatarUrl,
    string Timezone,
    string[] SkillTags,
    int CapacityHoursPerWeek);
