using GhtBackend.DTOs;
using GhtBackend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DiscountsController : ControllerBase
{
    private readonly DiscountService _discountService;

    public DiscountsController(DiscountService discountService)
    {
        _discountService = discountService;
    }

    [HttpPost("apply")]
    public async Task<IActionResult> ApplyDiscount([FromBody] ApplyDiscountRequest req)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            var result = await _discountService.ValidateAndApply(req.Code, userId, req.Items, req.OriginalAmount);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
