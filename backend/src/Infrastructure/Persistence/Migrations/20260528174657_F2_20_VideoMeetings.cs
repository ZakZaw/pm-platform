using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class F2_20_VideoMeetings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ActiveParticipantCount",
                table: "meetings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "RecordingEgressId",
                table: "meetings",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RecordingStartedAt",
                table: "meetings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RecordingStoppedAt",
                table: "meetings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecordingUrl",
                table: "meetings",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "meeting_guest_links",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MeetingId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    GuestLabel = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meeting_guest_links", x => x.Id);
                    table.ForeignKey(
                        name: "FK_meeting_guest_links_meetings_MeetingId",
                        column: x => x.MeetingId,
                        principalTable: "meetings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_meeting_guest_links_MeetingId",
                table: "meeting_guest_links",
                column: "MeetingId");

            migrationBuilder.CreateIndex(
                name: "IX_meeting_guest_links_Token",
                table: "meeting_guest_links",
                column: "Token",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "meeting_guest_links");

            migrationBuilder.DropColumn(
                name: "ActiveParticipantCount",
                table: "meetings");

            migrationBuilder.DropColumn(
                name: "RecordingEgressId",
                table: "meetings");

            migrationBuilder.DropColumn(
                name: "RecordingStartedAt",
                table: "meetings");

            migrationBuilder.DropColumn(
                name: "RecordingStoppedAt",
                table: "meetings");

            migrationBuilder.DropColumn(
                name: "RecordingUrl",
                table: "meetings");
        }
    }
}
