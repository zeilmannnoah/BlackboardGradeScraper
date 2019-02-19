const gradeService = require('../services/gradeService');

class Index {
    async grades(req, res) {
        const grades = await gradeService.getGrades();

        res.send(grades);
    }
}

module.exports = Index;