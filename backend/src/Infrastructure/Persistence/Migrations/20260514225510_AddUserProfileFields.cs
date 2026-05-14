using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserProfileFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AvatarUrl",
                table: "users",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CapacityHoursPerWeek",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 40);

            migrationBuilder.AddColumn<string[]>(
                name: "SkillTags",
                table: "users",
                type: "text[]",
                nullable: false,
                defaultValueSql: "ARRAY[]::text[]");

            migrationBuilder.AddColumn<string>(
                name: "Timezone",
                table: "users",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "UTC");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AvatarUrl",
                table: "users");

            migrationBuilder.DropColumn(
                name: "CapacityHoursPerWeek",
                table: "users");

            migrationBuilder.DropColumn(
                name: "SkillTags",
                table: "users");

            migrationBuilder.DropColumn(
                name: "Timezone",
                table: "users");
        }
    }
}
