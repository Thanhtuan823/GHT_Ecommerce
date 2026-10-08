using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using GhtBackend.DTOs;

namespace GhtBackend.Controllers;

[ApiController]
[Route("api/shipping")]
public class ShippingController : ControllerBase
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _config;

    public ShippingController(HttpClient httpClient, IConfiguration config)
    {
        _httpClient = httpClient;
        _config = config;
    }

    [HttpGet("provinces")]
    public async Task<IActionResult> GetProvinces()
    {
        var token = _config["GHN:Token"];
        var req = new HttpRequestMessage(HttpMethod.Get, "https://online-gateway.ghn.vn/shiip/public-api/master-data/province");
        req.Headers.Add("Token", token);
        var res = await _httpClient.SendAsync(req);
        var content = await res.Content.ReadAsStringAsync();
        return Content(content, "application/json");
    }

    [HttpGet("districts/{provinceId}")]
    public async Task<IActionResult> GetDistricts(string provinceId)
    {
        var token = _config["GHN:Token"];
        var req = new HttpRequestMessage(HttpMethod.Get, $"https://online-gateway.ghn.vn/shiip/public-api/master-data/district?province_id={provinceId}");
        req.Headers.Add("Token", token);
        var res = await _httpClient.SendAsync(req);
        var content = await res.Content.ReadAsStringAsync();
        return Content(content, "application/json");
    }

    [HttpGet("wards/{districtId}")]
    public async Task<IActionResult> GetWards(string districtId)
    {
        var token = _config["GHN:Token"];
        var req = new HttpRequestMessage(HttpMethod.Get, $"https://online-gateway.ghn.vn/shiip/public-api/master-data/ward?district_id={districtId}");
        req.Headers.Add("Token", token);
        var res = await _httpClient.SendAsync(req);
        var content = await res.Content.ReadAsStringAsync();
        return Content(content, "application/json");
    }

    [HttpPost("fee")]
    public async Task<IActionResult> CalculateFee([FromBody] CalculateFeeRequest req)
    {
        var token = _config["GHN:Token"];
        var shopId = _config["GHN:ShopId"];
        
        var ghnReq = new {
            service_type_id = 2,
            insurance_value = 0,
            coupon = null as string,
            to_ward_code = req.WardCode,
            to_district_id = int.Parse(req.DistrictId),
            from_district_id = 1454, // Mocked origin district
            weight = req.Weight,
            length = 20,
            width = 20,
            height = 10
        };

        var requestMessage = new HttpRequestMessage(HttpMethod.Post, "https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/fee");
        requestMessage.Headers.Add("Token", token);
        requestMessage.Headers.Add("ShopId", shopId);
        requestMessage.Content = JsonContent.Create(ghnReq);

        try {
            var response = await _httpClient.SendAsync(requestMessage);
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var json = JsonDocument.Parse(content);
                var total = json.RootElement.GetProperty("data").GetProperty("total").GetInt32();
                return Ok(new { fee = total });
            }
        } catch {
            // Fallback if network or GHN is down
        }

        return Ok(new { fee = 30000 });
    }
}
