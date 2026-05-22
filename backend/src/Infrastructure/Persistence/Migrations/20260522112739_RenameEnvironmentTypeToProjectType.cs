using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenameEnvironmentTypeToProjectType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "EnvironmentType",
                table: "projects",
                newName: "Type");

            migrationBuilder.RenameColumn(
                name: "EnvironmentType",
                table: "epics",
                newName: "Type");

            migrationBuilder.RenameColumn(
                name: "EnvironmentType",
                table: "ai_generation_requests",
                newName: "Type");

            // Remap legacy enum values to the new ProjectType vocabulary.
            // Developer → Engineering, Business → Generic;
            // Support/Sales kept as-is. AIGenerationRequest stores strings.
            migrationBuilder.Sql("UPDATE projects SET \"Type\" = 'Engineering' WHERE \"Type\" = 'Developer';");
            migrationBuilder.Sql("UPDATE projects SET \"Type\" = 'Generic' WHERE \"Type\" = 'Business';");
            migrationBuilder.Sql("UPDATE epics SET \"Type\" = 'Engineering' WHERE \"Type\" = 'Developer';");
            migrationBuilder.Sql("UPDATE epics SET \"Type\" = 'Generic' WHERE \"Type\" = 'Business';");
            migrationBuilder.Sql("UPDATE ai_generation_requests SET \"Type\" = 'Engineering' WHERE \"Type\" = 'Developer';");
            migrationBuilder.Sql("UPDATE ai_generation_requests SET \"Type\" = 'Generic' WHERE \"Type\" = 'Business';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Roll the data values back first (best-effort: Marketing /
            // Operations have no Phase-1 equivalents — those rows would need
            // a manual review if a downgrade ever happens).
            migrationBuilder.Sql("UPDATE projects SET \"Type\" = 'Developer' WHERE \"Type\" = 'Engineering';");
            migrationBuilder.Sql("UPDATE projects SET \"Type\" = 'Business' WHERE \"Type\" IN ('Generic', 'Marketing', 'Operations');");
            migrationBuilder.Sql("UPDATE epics SET \"Type\" = 'Developer' WHERE \"Type\" = 'Engineering';");
            migrationBuilder.Sql("UPDATE epics SET \"Type\" = 'Business' WHERE \"Type\" IN ('Generic', 'Marketing', 'Operations');");
            migrationBuilder.Sql("UPDATE ai_generation_requests SET \"Type\" = 'Developer' WHERE \"Type\" = 'Engineering';");
            migrationBuilder.Sql("UPDATE ai_generation_requests SET \"Type\" = 'Business' WHERE \"Type\" IN ('Generic', 'Marketing', 'Operations');");

            migrationBuilder.RenameColumn(
                name: "Type",
                table: "projects",
                newName: "EnvironmentType");

            migrationBuilder.RenameColumn(
                name: "Type",
                table: "epics",
                newName: "EnvironmentType");

            migrationBuilder.RenameColumn(
                name: "Type",
                table: "ai_generation_requests",
                newName: "EnvironmentType");
        }
    }
}
