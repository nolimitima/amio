module.exports = (req, res) => {
  const uuid = req.query && req.query.uuid;
  res.status(200).json({ ok: true, route: "[uuid]", uuid });
};
