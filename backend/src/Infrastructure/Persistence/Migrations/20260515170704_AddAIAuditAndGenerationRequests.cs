using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAIAuditAndGenerationRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CreatedByAi",
                table: "epics",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "ai_audit_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ActionType = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: true),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Prompt = table.Column<string>(type: "text", nullable: false),
                    Response = table.Column<string>(type: "text", nullable: true),
                    BeforeStateJson = table.Column<string>(type: "text", nullable: true),
                    AfterStateJson = table.Column<string>(type: "text", nullable: true),
                    Provider = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Model = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    Applied = table.Column<bool>(type: "boolean", nullable: false),
                    ErrorMessage = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_audit_logs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ai_generation_requests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "uuid", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    EnvironmentType = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ClarificationsJson = table.Column<string>(type: "text", nullable: true),
                    PreviewJson = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AppliedProjectId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AppliedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_generation_requests", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ai_audit_logs_ProjectId",
                table: "ai_audit_logs",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ai_audit_logs_UserId_CreatedAt",
                table: "ai_audit_logs",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ai_generation_requests_CreatedBy_Status",
                table: "ai_generation_requests",
                columns: new[] { "CreatedBy", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_ai_generation_requests_OrganizationId_CreatedAt",
                table: "ai_generation_requests",
                columns: new[] { "OrganizationId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_audit_logs");

            migrationBuilder.DropTable(
                name: "ai_generation_requests");

            migrationBuilder.DropColumn(
                name: "CreatedByAi",
                table: "epics");
        }
    }
}
