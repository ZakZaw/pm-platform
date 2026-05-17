using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DropStoriesAndReshapeTasks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_tasks_stories_StoryId",
                table: "tasks");

            migrationBuilder.DropTable(
                name: "stories");

            migrationBuilder.DropIndex(
                name: "IX_tasks_StoryId",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_projects_OrganizationId_Slug",
                table: "projects");

            migrationBuilder.RenameColumn(
                name: "StoryId",
                table: "tasks",
                newName: "ProjectId");

            migrationBuilder.AddColumn<string[]>(
                name: "AcceptanceCriteria",
                table: "tasks",
                type: "text[]",
                nullable: false,
                defaultValueSql: "ARRAY[]::text[]");

            migrationBuilder.AddColumn<DateTime>(
                name: "DueDate",
                table: "tasks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "EpicId",
                table: "tasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PriorityOrder",
                table: "tasks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ReporterId",
                table: "tasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SprintId",
                table: "tasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "StoryPoints",
                table: "tasks",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "projects",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<bool>(
                name: "IsPersonal",
                table: "projects",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "OwnerUserId",
                table: "projects",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_tasks_EpicId",
                table: "tasks",
                column: "EpicId");

            migrationBuilder.CreateIndex(
                name: "IX_tasks_ProjectId_Status",
                table: "tasks",
                columns: new[] { "ProjectId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_tasks_ReporterId",
                table: "tasks",
                column: "ReporterId");

            migrationBuilder.CreateIndex(
                name: "IX_tasks_SprintId",
                table: "tasks",
                column: "SprintId");

            migrationBuilder.CreateIndex(
                name: "IX_projects_OrganizationId_Slug",
                table: "projects",
                columns: new[] { "OrganizationId", "Slug" },
                unique: true,
                filter: "\"OrganizationId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_projects_OwnerUserId",
                table: "projects",
                column: "OwnerUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_projects_users_OwnerUserId",
                table: "projects",
                column: "OwnerUserId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_tasks_epics_EpicId",
                table: "tasks",
                column: "EpicId",
                principalTable: "epics",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_tasks_projects_ProjectId",
                table: "tasks",
                column: "ProjectId",
                principalTable: "projects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_tasks_sprints_SprintId",
                table: "tasks",
                column: "SprintId",
                principalTable: "sprints",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_tasks_users_ReporterId",
                table: "tasks",
                column: "ReporterId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_projects_users_OwnerUserId",
                table: "projects");

            migrationBuilder.DropForeignKey(
                name: "FK_tasks_epics_EpicId",
                table: "tasks");

            migrationBuilder.DropForeignKey(
                name: "FK_tasks_projects_ProjectId",
                table: "tasks");

            migrationBuilder.DropForeignKey(
                name: "FK_tasks_sprints_SprintId",
                table: "tasks");

            migrationBuilder.DropForeignKey(
                name: "FK_tasks_users_ReporterId",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_tasks_EpicId",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_tasks_ProjectId_Status",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_tasks_ReporterId",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_tasks_SprintId",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_projects_OrganizationId_Slug",
                table: "projects");

            migrationBuilder.DropIndex(
                name: "IX_projects_OwnerUserId",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "AcceptanceCriteria",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "DueDate",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "EpicId",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "PriorityOrder",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "ReporterId",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "SprintId",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "StoryPoints",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "IsPersonal",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "OwnerUserId",
                table: "projects");

            migrationBuilder.RenameColumn(
                name: "ProjectId",
                table: "tasks",
                newName: "StoryId");

            migrationBuilder.AlterColumn<Guid>(
                name: "OrganizationId",
                table: "projects",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateTable(
                name: "stories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AssigneeId = table.Column<Guid>(type: "uuid", nullable: true),
                    EpicId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProjectId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReporterId = table.Column<Guid>(type: "uuid", nullable: true),
                    SprintId = table.Column<Guid>(type: "uuid", nullable: true),
                    AcceptanceCriteria = table.Column<string[]>(type: "text[]", nullable: false, defaultValueSql: "ARRAY[]::text[]"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedByAi = table.Column<bool>(type: "boolean", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: true),
                    DueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Priority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    PriorityOrder = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    StoryPoints = table.Column<int>(type: "integer", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_stories_epics_EpicId",
                        column: x => x.EpicId,
                        principalTable: "epics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_stories_projects_ProjectId",
                        column: x => x.ProjectId,
                        principalTable: "projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_stories_sprints_SprintId",
                        column: x => x.SprintId,
                        principalTable: "sprints",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_stories_users_AssigneeId",
                        column: x => x.AssigneeId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_stories_users_ReporterId",
                        column: x => x.ReporterId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_tasks_StoryId",
                table: "tasks",
                column: "StoryId");

            migrationBuilder.CreateIndex(
                name: "IX_projects_OrganizationId_Slug",
                table: "projects",
                columns: new[] { "OrganizationId", "Slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_stories_AssigneeId",
                table: "stories",
                column: "AssigneeId");

            migrationBuilder.CreateIndex(
                name: "IX_stories_EpicId",
                table: "stories",
                column: "EpicId");

            migrationBuilder.CreateIndex(
                name: "IX_stories_ProjectId_Status",
                table: "stories",
                columns: new[] { "ProjectId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_stories_ReporterId",
                table: "stories",
                column: "ReporterId");

            migrationBuilder.CreateIndex(
                name: "IX_stories_SprintId",
                table: "stories",
                column: "SprintId");

            migrationBuilder.AddForeignKey(
                name: "FK_tasks_stories_StoryId",
                table: "tasks",
                column: "StoryId",
                principalTable: "stories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
