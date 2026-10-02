import { checkUrlsSafety } from "../services/safe-browsing.service.js";
import { ValidationError } from "../utils/errors.js";

/**
 * Controller to check one or more URLs against Google Safe Browsing.
 */
export async function checkUrlsSafetyController(req, res, next) {
  try {
    const { url, urls } = req.body ?? {};

    const targetUrls = [];

    if (typeof url === "string" && url.trim().length > 0) {
      targetUrls.push(url.trim());
    }

    if (Array.isArray(urls)) {
      for (const item of urls) {
        if (typeof item === "string" && item.trim().length > 0) {
          targetUrls.push(item.trim());
        }
      }
    }

    if (targetUrls.length === 0) {
      throw new ValidationError(
        "Please provide a 'url' (string) or 'urls' (array of strings) in the request body."
      );
    }

    const uniqueTargets = [...new Set(targetUrls)].slice(0, 100); // limit to 100 per call
    const resultsMap = await checkUrlsSafety(uniqueTargets);

    const results = uniqueTargets.map((target) => {
      const data = resultsMap.get(target) ?? {
        knownThreatFound: false,
        status: "NO_MATCH",
        threats: [],
        source: "Google Safe Browsing v4",
        limitation: "No known threat was found; this does not guarantee safety."
      };
      return {
        url: target,
        knownThreatFound: data.knownThreatFound,
        status: data.status,
        threats: data.threats,
        limitation: data.limitation
      };
    });

    return res.status(200).json({
      success: true,
      totalChecked: results.length,
      results
    });
  } catch (error) {
    next(error);
  }
}

export default {
  checkUrlsSafetyController
};
