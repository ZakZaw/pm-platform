using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskListsAndTaskListIdOnTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TaskListId",
                table: "tasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "task_lists",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_task_lists", x => x.Id);
                    table.ForeignKey(
                        name: "FK_task_lists_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tasks_TaskListId",
                table: "tasks",
                column: "TaskListId");

            migrationBuilder.CreateIndex(
                name: "IX_task_lists_ProjectId_Order",
                table: "task_lists",
                columns: new[] { "ProjectId", "Order" });

            migrationBuilder.AddForeignKey(
                name: "FK_tasks_task_lists_TaskListId",
                table: "tasks",
                column: "TaskListId",
                principalTable: "task_lists",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tasks_task_lists_TaskListId",
                table: "tasks");

            migrationBuilder.DropTable(
                name: "task_lists");

            migrationBuilder.DropIndex(
                name: "IX_tasks_TaskListId",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "TaskListId",
                table: "tasks");
        }
    }
}
