using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class M8_ProjectTaskKeyCounter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LastTaskKeyNum",
                table: "projects",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Start every counter at the project's current highest key.
            migrationBuilder.Sql(
                "UPDATE projects p SET \"LastTaskKeyNum\" = " +
                "COALESCE((SELECT MAX(t.\"KeyNum\") FROM tasks t WHERE t.\"ProjectId\" = p.\"Id\"), 0);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastTaskKeyNum",
                table: "projects");
        }
    }
}
