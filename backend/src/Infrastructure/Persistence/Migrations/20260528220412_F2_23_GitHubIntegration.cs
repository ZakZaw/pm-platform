using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class F2_23_GitHubIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CiStatus",
                table: "tasks",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CiUrl",
                table: "tasks",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PrNumber",
                table: "tasks",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PrState",
                table: "tasks",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "integrations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Provider = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    RepoFullName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    AccessToken = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    WebhookSecret = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    WebhookId = table.Column<long>(type: "bigint", nullable: true),
                    ConnectedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastEventAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_integrations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_integrations_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_integrations_users_ConnectedByUserId",
                        column: x => x.ConnectedByUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_integrations_ConnectedByUserId",
                table: "integrations",
                column: "ConnectedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_integrations_ProjectId",
                table: "integrations",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_integrations_Provider_RepoFullName",
                table: "integrations",
                columns: new[] { "Provider", "RepoFullName" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "integrations");

            migrationBuilder.DropColumn(
                name: "CiStatus",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "CiUrl",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "PrNumber",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "PrState",
                table: "tasks");
        }
    }
}
