const public = (req, res) => {
    res.json('hello from public');
};

const private = (req, res) => {
    res.json('hello from private');
};

const adminPath = (req, res) => {
    res.json('hello from admin');
};

module.exports = {
    public,
    private,
    adminPath,
}