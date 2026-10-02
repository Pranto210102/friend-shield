import { resolveRedirects } from "../services/redirect-resolver.service.js";
import { ValidationError } from "../utils/errors.js";

/**
 * Controller to resolve URL shorteners and redirects.
 */
export async function resolveUrlRedirect(req, res, next) {
  try {
    const { url } = req.body ?? {};

    if (typeof url !== "string" || url.trim().length === 0) {
      throw new ValidationError("A 'url' string is required in the request body.");
    }

    const trimmedUrl = url.trim();
    const result = await resolveRedirects(trimmedUrl);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export default {
  resolveUrlRedirect
};
