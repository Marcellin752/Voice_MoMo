/**
 * Vérifie que les champs requis sont présents, non null et non vides.
 * @param {string[]} fields
 */

function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => {
      const val = req.body?.[field];
      return val === undefined || val === null || val === "";
    });

    if (missing.length > 0) {
      return res
        .status(400)
        .json({ error: `Champs manquants ou vides: ${missing.join(", ")}` });
    }
    return next();
  };
}

module.exports = { requireFields };
