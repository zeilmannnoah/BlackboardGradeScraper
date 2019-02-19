const puppeteer = require('puppeteer');

const USERNAME = process.env.BB_USERNAME,
    PASSWORD = process.env.BB_PASSWORD,
    TIMEOUT = 10000;

async function getGrades(all) {
    const browser = await puppeteer.launch({headless: true}),
        page = await browser.newPage();

    let courseData, courseFrame;

    console.log('Loading CAS');
    try {
        await page.goto('https://blackboard.missouristate.edu/webapps/bb-auth-provider-cas-BB5a78bae342181/execute/casLogin?cmd=login&authProviderId=_102_1&redirectUrl=https%3A%2F%2Fblackboard.missouristate.edu%2Fwebapps%2Fportal%2Fexecute%2FdefaultTab');
    }
    catch (err) {
        console.error('Error loading page', err);
        await browser.close();
        throw err;
    }

    console.log('Entering username and password');
    try {
        await page.type('input#username', USERNAME);
        await page.type('input#password', PASSWORD);

        await Promise.all([
            page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: TIMEOUT}),
            page.click('#BearPassForm > div > input')
        ]);
    }
    catch (err) {
        console.error('Error entering username and password into CAS.\t', err);
        await browser.close();
        throw err;
    }

    console.log('Loading Blackboard');
    try {
        await Promise.all([
            page.waitForNavigation({waitUntil: 'domcontentloaded', timeout: TIMEOUT}),
            page.click('a[href^="/webapps/gradebook"]')
        ]);
    }
    catch (err) {
        console.error('Error loading Blackboard.\t', err);
        await browser.close();
        throw err;
    }

    console.log('Accepting cookies');
    try {
        await page.waitForSelector('#agree_button', {timeout: TIMEOUT});
        await page.click('#agree_button');
    }
    catch (err) {
        console.error('Error accepting cookies.\t', err);
        await browser.close();
        throw err;
    }

    console.log('Parsing Courses');
    try {
        courseFrame = page.frames().find(frame => frame.name() === 'mybbCanvas');

        await courseFrame.waitForSelector('.stream_item', {timeout: TIMEOUT});

        courseData = await courseFrame.evaluate((semesterCode, all) => {
            let courses = document.querySelectorAll('.stream_item'),
                courseData = [];

            for (course of courses) {
                let courseName = course.querySelector('.stream_area_name').innerText;
                
                if (all || courseName.toUpperCase().includes(semesterCode)) {
                    let gradeValue = course.querySelector('.grade-value').innerText,
                        lastUpdated = course.querySelector('.stream_datestamp').innerText === '' ? '-' : course.querySelector('.stream_datestamp').innerText;

                    courseData.push({courseName, gradeValue, lastUpdated, gradeUrl: course.getAttribute('bb:rhs'), items: []});
                }
            }

            return Promise.resolve(courseData);
        }, getSemesterCode(), all);
    }
    catch (err) {
        console.error('Error parsing courses.\t', err);
        await browser.close();
        throw err;
    }

    console.log('Parsing Grades');
    try {
        const gradeFrame = courseFrame.childFrames().find(frame => frame.name() === 'right_stream_mygrades');

        for (course of courseData) {
            await Promise.all([
                gradeFrame.goto('https://blackboard.missouristate.edu' + course.gradeUrl),
                gradeFrame.waitForNavigation({waitUntil: 'domcontentloaded', timeout: TIMEOUT})
            ]);
            
            await gradeFrame.waitForSelector('#grades_wrapper', {timeout: TIMEOUT});

            let parsedGrades = await gradeFrame.evaluate((course) => {
                let gradedItems = document.querySelectorAll('.sortable_item_row:not(.calculatedRow)'),
                    itemArr = [];

                gradedItems.forEach(grade => {
                    let title = grade.querySelector('.cell.gradable').innerText.split("\n")[0],
                        due = grade.querySelector('.gradable > .activityType') ? grade.querySelector('.gradable > .activityType').innerText : 'No Due Date'
                        type = grade.querySelector('.itemCat').innerText,
                        submitted = grade.querySelector('.lastActivityDate').innerText === '' ? "Not Submitted" : grade.querySelector('.lastActivityDate').innerText,
                        status = grade.querySelector('.timestamp > .activityType').innerText,
                        isBoolean = grade.querySelector('.gradeStatus > span > span'),
                        score = isBoolean ? isBoolean.innerText : grade.querySelector('.grade > .grade').innerText,
                        total = isBoolean ? 'No Total' : grade.querySelector('.pointsPossible').innerText.replace('/', '');


                    itemArr.push({title, due, type, submitted, status, score, total});
                });

                return Promise.resolve(itemArr);
            }, course);

            course.items = parsedGrades;
            delete course.gradeUrl;
        }

    }
    catch (err) {
        console.error('Error parsing grades.\t', err);
        await browser.close();
        throw err;
    }

    try {
        console.log(`Complete, ${courseData.length} courses scraped. Closing browser.`);
        await browser.close();
    }
    catch (err) {
        console.error('Error closing browser\t', err);
        throw err;
    }

    return courseData;
};

function getSemesterCode() {
    let today = new Date(),
        month = today.getMonth(),
        year = today.getFullYear().toString().substring(2);

    return (month > 6 ? "FA" : "SP") + year;
}

module.exports = {getGrades};