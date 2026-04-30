const fakeredis = {
  setex: async () => "OK",
  get: async () => null,
  del: async () => 1,
  on: () => {},
};
module.exports = fakeredis;
