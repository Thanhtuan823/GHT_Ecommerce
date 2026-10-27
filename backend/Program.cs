using GhtBackend.Data;
using GhtBackend.Services;
using GhtBackend.Hubs;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// ① QuestPDF license — PHẢI đặt trước builder.Build()
QuestPDF.Settings.License = LicenseType.Community;
QuestPDF.Settings.UseSystemFonts = true;
QuestPDF.Settings.ThrowOnMissingFontFamilies = false;

// ② EF Core + PostgreSQL
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ③ CORS — cho phép frontend
builder.Services.AddCors(options => {
    options.AddPolicy("AllowFrontend", policy => {
        policy.WithOrigins(
            builder.Configuration["App:FrontendUrl"] ?? "http://localhost:5173"
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
    });
});

builder.Services.AddSignalR();

// ④ Hangfire — dùng PostgreSQL storage
builder.Services.AddHangfire(config =>
    config.UsePostgreSqlStorage(options =>
        options.UseNpgsqlConnection(builder.Configuration.GetConnectionString("DefaultConnection"))
    )
);
builder.Services.AddHangfireServer();

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

// Add Authentication and Authorization to allow app.UseAuthentication() and app.UseAuthorization()
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<DiscountService>();
builder.Services.AddScoped<PdfService>();
builder.Services.AddScoped<AdminService>();
builder.Services.AddScoped<AiService>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<EmailService>();
builder.Services.AddTransient<OrderBackgroundService>();
builder.Services.AddTransient<ReportBackgroundService>();
builder.Services.AddHttpClient();

var jwtSecret = builder.Configuration["Jwt:Secret"] ?? throw new InvalidOperationException("Jwt:Secret is missing");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.Zero
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/chat"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

// ⑤ Swagger (chỉ Development)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    DbSeeder.Seed(dbContext);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ⑥ Middleware thứ tự đúng
var uploadsFolder = Path.Combine(builder.Environment.ContentRootPath, "backend", "wwwroot", "uploads");
if (!Directory.Exists(uploadsFolder))
{
    uploadsFolder = Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "uploads");
}
if (!Directory.Exists(uploadsFolder))
{
    Directory.CreateDirectory(uploadsFolder);
}

app.UseStaticFiles(); // Cho default wwwroot
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsFolder),
    RequestPath = "/uploads"
});
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseHangfireDashboard("/hangfire");

RecurringJob.AddOrUpdate<OrderBackgroundService>(
    "expire-orders",
    x => x.ExpireOrders(),
    Cron.Minutely()
);

RecurringJob.AddOrUpdate<ReportBackgroundService>(
    "daily-report",
    x => x.GenerateDailyReport(),
    "59 23 * * *"
);

RecurringJob.AddOrUpdate<ReportBackgroundService>(
    "weekly-report",
    x => x.GenerateWeeklyReport(),
    "0 8 * * 1"
);

RecurringJob.AddOrUpdate<ReportBackgroundService>(
    "low-stock-alert",
    x => x.CheckLowStock(),
    "0 9 * * *"
);

app.MapHub<ChatHub>("/hubs/chat");
app.MapControllers();

app.Run();
