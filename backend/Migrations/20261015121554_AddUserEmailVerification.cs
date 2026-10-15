using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GhtBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddUserEmailVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EmailVerificationOtp",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "EmailVerificationOtpExpiresAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "EmailVerified",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EmailVerificationOtp",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "EmailVerificationOtpExpiresAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "EmailVerified",
                table: "Users");
        }
    }
}
