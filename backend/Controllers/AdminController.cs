using GhtBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GhtBackend.Controllers
{
    [ApiController]
    [Route("api/admin")]
    public class AdminController : ControllerBase
    {
        private readonly AdminService _adminService;

        public AdminController(AdminService adminService)
        {
            _adminService = adminService;
        }

        [HttpGet("dashboard")]
        [Authorize(Roles = "Admin,Staff")]
        public async Task<IActionResult> GetDashboard([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var stats = await _adminService.GetDashboardStatsAsync(from, to);
            return Ok(stats);
        }

        [HttpGet("export-excel")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> ExportExcel([FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            var excelBytes = await _adminService.ExportExcelAsync(from, to);
            
            var fileName = $"GHT_Revenue_{(from.HasValue ? from.Value.ToString("yyyy-MM-dd") : "All")}_{(to.HasValue ? to.Value.ToString("yyyy-MM-dd") : "All")}.xlsx";
            
            return File(excelBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
        }
    }
}
