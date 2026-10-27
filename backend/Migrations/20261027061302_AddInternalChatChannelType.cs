using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GhtBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddInternalChatChannelType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'ChatConversations' AND column_name = 'Type'
                    ) THEN
                        ALTER TABLE ""ChatConversations"" ADD COLUMN ""Type"" text NOT NULL DEFAULT 'CUSTOMER_SUPPORT';
                    ELSE
                        UPDATE ""ChatConversations"" SET ""Type"" = 'CUSTOMER_SUPPORT' WHERE ""Type"" IS NULL OR ""Type"" = '';
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Type",
                table: "ChatConversations");
        }
    }
}
