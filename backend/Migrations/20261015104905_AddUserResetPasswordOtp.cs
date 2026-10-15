using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GhtBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddUserResetPasswordOtp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ResetPasswordOtp",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ResetPasswordOtpExpiresAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ResetPasswordOtp",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "ResetPasswordOtpExpiresAt",
                table: "Users");
        }
    }
}
