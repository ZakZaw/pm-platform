using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrgMembershipRemovedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_org_memberships_OrganizationId_UserId",
                table: "org_memberships");

            migrationBuilder.AddColumn<DateTime>(
                name: "RemovedAt",
                table: "org_memberships",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_org_memberships_OrganizationId_UserId",
                table: "org_memberships",
                columns: new[] { "OrganizationId", "UserId" },
                unique: true,
                filter: "\"RemovedAt\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_org_memberships_OrganizationId_UserId",
                table: "org_memberships");

            migrationBuilder.DropColumn(
                name: "RemovedAt",
                table: "org_memberships");

            migrationBuilder.CreateIndex(
                name: "IX_org_memberships_OrganizationId_UserId",
                table: "org_memberships",
                columns: new[] { "OrganizationId", "UserId" },
                unique: true);
        }
    }
}
