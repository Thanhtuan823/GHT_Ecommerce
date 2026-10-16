using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GhtBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddHomeFeaturedAndVoucherWallet : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateTime>(
                name: "UsedAt",
                table: "UserUsedDiscounts",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone");

            migrationBuilder.AddColumn<bool>(
                name: "IsUsed",
                table: "UserUsedDiscounts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "OrderId",
                table: "UserUsedDiscounts",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SavedAt",
                table: "UserUsedDiscounts",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<int>(
                name: "OriginalPrice",
                table: "Products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ViewCount",
                table: "Products",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_UserUsedDiscounts_OrderId",
                table: "UserUsedDiscounts",
                column: "OrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_UserUsedDiscounts_Orders_OrderId",
                table: "UserUsedDiscounts",
                column: "OrderId",
                principalTable: "Orders",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_UserUsedDiscounts_Orders_OrderId",
                table: "UserUsedDiscounts");

            migrationBuilder.DropIndex(
                name: "IX_UserUsedDiscounts_OrderId",
                table: "UserUsedDiscounts");

            migrationBuilder.DropColumn(
                name: "IsUsed",
                table: "UserUsedDiscounts");

            migrationBuilder.DropColumn(
                name: "OrderId",
                table: "UserUsedDiscounts");

            migrationBuilder.DropColumn(
                name: "SavedAt",
                table: "UserUsedDiscounts");

            migrationBuilder.DropColumn(
                name: "OriginalPrice",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ViewCount",
                table: "Products");

            migrationBuilder.AlterColumn<DateTime>(
                name: "UsedAt",
                table: "UserUsedDiscounts",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified),
                oldClrType: typeof(DateTime),
                oldType: "timestamp with time zone",
                oldNullable: true);
        }
    }
}
