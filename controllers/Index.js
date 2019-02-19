const gradeService = require('../services/gradeService');

class Index {
    async grades(req, res) {
        try {
            const grades = await gradeService.getGrades(req.query.all);

            res.send(grades);
        }
        catch(err) {
            res.send({msg: 'Error occured, try again', err});
        }
    }
}

module.exports = Index;