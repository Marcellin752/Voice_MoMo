function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => req.body?.[field] === undefined || req.body?.[field] === null);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Champs manquants: ${missing.join(", ")}` });
    }
    return next();
  };
}

module.exports = {
  requireFields,
};
