using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace GhtBackend.Helpers;

public static class SlugHelper
{
    public static string GenerateSlug(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return string.Empty;

        // Remove diacritics (Vietnamese accents)
        text = text.Normalize(NormalizationForm.FormD);
        var chars = text.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray();
        string normalized = new string(chars).Normalize(NormalizationForm.FormC);

        // Convert to lower case
        normalized = normalized.ToLowerInvariant();

        // Replace invalid characters with hyphens
        normalized = Regex.Replace(normalized, @"[^a-z0-9\s-]", "");
        
        // Replace multiple spaces/hyphens with a single hyphen
        normalized = Regex.Replace(normalized, @"[\s-]+", "-").Trim('-');

        return normalized;
    }
}
