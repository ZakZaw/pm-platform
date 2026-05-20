using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SprintRemoveGoalAddActualStart : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Goal",
                table: "sprints");

            migrationBuilder.AddColumn<DateTime>(
                name: "ActualStartDate",
                table: "sprints",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActualStartDate",
                table: "sprints");

            migrationBuilder.AddColumn<string>(
                name: "Goal",
                table: "sprints",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }
    }
}
