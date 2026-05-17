using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class WorkflowCustomStatuses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_project_status_configs_ProjectId_Status",
                table: "project_status_configs");

            migrationBuilder.CreateIndex(
                name: "IX_project_status_configs_ProjectId_Status",
                table: "project_status_configs",
                columns: new[] { "ProjectId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_project_status_configs_ProjectId_Status",
                table: "project_status_configs");

            migrationBuilder.CreateIndex(
                name: "IX_project_status_configs_ProjectId_Status",
                table: "project_status_configs",
                columns: new[] { "ProjectId", "Status" },
                unique: true);
        }
    }
}
