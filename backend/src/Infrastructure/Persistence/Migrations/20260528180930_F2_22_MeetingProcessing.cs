using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class F2_22_MeetingProcessing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SourceMeetingId",
                table: "tasks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BlockersJson",
                table: "meetings",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DecisionsJson",
                table: "meetings",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OpenQuestionsJson",
                table: "meetings",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ProcessedAt",
                table: "meetings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SummaryMd",
                table: "meetings",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "meeting_action_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    SuggestedOwnerUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    SuggestedDueDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SuggestedPriority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AcceptedTaskId = table.Column<Guid>(type: "uuid", nullable: true),
                    AcceptedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    DismissedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DismissedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    OrderIndex = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meeting_action_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_meeting_action_items_meetings_MeetingId",
                        column: x => x.MeetingId,
                        principalTable: "meetings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_meeting_action_items_users_SuggestedOwnerUserId",
                        column: x => x.SuggestedOwnerUserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_meeting_action_items_MeetingId_OrderIndex",
                table: "meeting_action_items",
                columns: new[] { "MeetingId", "OrderIndex" });

            migrationBuilder.CreateIndex(
                name: "IX_meeting_action_items_SuggestedOwnerUserId",
                table: "meeting_action_items",
                column: "SuggestedOwnerUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "meeting_action_items");

            migrationBuilder.DropColumn(
                name: "SourceMeetingId",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "BlockersJson",
                table: "meetings");

            migrationBuilder.DropColumn(
                name: "DecisionsJson",
                table: "meetings");

            migrationBuilder.DropColumn(
                name: "OpenQuestionsJson",
                table: "meetings");

            migrationBuilder.DropColumn(
                name: "ProcessedAt",
                table: "meetings");

            migrationBuilder.DropColumn(
                name: "SummaryMd",
                table: "meetings");
        }
    }
}
