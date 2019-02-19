const puppeteer = require('puppeteer');

async function getGrades() {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();

    let courseData, courseFrame;

    console.log('Loading CAS');
    try {
        await page.goto('https://blackboard.missouristate.edu/webapps/bb-auth-provider-cas-BB5a78bae342181/execute/casLogin?cmd=login&authProviderId=_102_1&redirectUrl=https%3A%2F%2Fblackboard.missouristate.edu%2Fwebapps%2Fportal%2Fexecute%2FdefaultTab');
    }
    catch (err) {
        console.error('Error loading page', err);
        return await browser.close();
    }

    console.log('Entering username and password');
    try {
        await page.type('input#username', 'naz796');
        await page.type('input#password', 'Scootergrove90');

        await Promise.all([
            page.waitForNavigation({waitUntil: 'domcontentloaded'}),
            page.click('#BearPassForm > div > input')
        ]);
    }
    catch (err) {
        console.error('Error entering username and password into CAS.\t', err);
        return await browser.close();
    }

    console.log('Loading Blackboard');
    try {
        await Promise.all([
            page.waitForNavigation({waitUntil: 'domcontentloaded'}),
            page.click('a[href^="/webapps/gradebook"]')
        ]);
    }
    catch (err) {
        console.error('Error loading Blackboard.\t', err);
        return await browser.close();
    }

    console.log('Accepting cookies');
    try {
        await page.waitForSelector('#agree_button', {timeout: 10000});
        await page.click('#agree_button');
    }
    catch (err) {
        console.error('Error accepting cookies.\t', err);
        return await browser.close();
    }

    console.log('Parsing Courses');
    try {
        courseFrame = page.frames().find(frame => frame.name() === 'mybbCanvas');

        await courseFrame.waitForSelector('.stream_item', {timeout: 10000});

        courseData = await courseFrame.evaluate((semesterCode) => {
            let courses = document.querySelectorAll('.stream_item'),
                courseData = [];

            for (course of courses) {
                let entryName = course.querySelector('.stream_area_name').innerText;
                
                if (entryName.toUpperCase().includes(semesterCode)) {
                    let gradeValue = course.querySelector('.grade-value').innerText,
                        lastUpdated = course.querySelector('.stream_datestamp').innerText;

                    courseData.push({entryName, gradeValue, lastUpdated, gradeUrl: course.getAttribute('bb:rhs'), items: []});
                }
            }

            return Promise.resolve(courseData);
        }, getSemesterCode());
    }
    catch (err) {
        console.error('Error parsing courses.\t', err);
        return await browser.close();
    }

    console.log('Parsing Grades');
    try {
        const gradeFrame = courseFrame.childFrames().find(frame => frame.name() === 'right_stream_mygrades');

        for (course of courseData) {
            await Promise.all([
                gradeFrame.goto('https://blackboard.missouristate.edu' + course.gradeUrl),
                gradeFrame.waitForNavigation({waitUntil: 'domcontentloaded'})
            ]);
            
            await gradeFrame.waitForSelector('#grades_wrapper', {timeout: 10000});

            let parsedGrades = await gradeFrame.evaluate((course) => {
                let gradedItems = document.querySelectorAll('.sortable_item_row:not(.calculatedRow)'),
                    itemArr = [];

                gradedItems.forEach(grade => {
                    let title = grade.querySelector('.cell.gradable').innerText.split("\n")[0],
                        due = grade.querySelector('.gradable > .activityType') ? grade.querySelector('.gradable > .activityType').innerText : 'No Due Date'
                        type = grade.querySelector('.itemCat').innerText,
                        submitted = grade.querySelector('.lastActivityDate').innerText === "" ? "Not Submitted" : grade.querySelector('.lastActivityDate').innerText,
                        status = grade.querySelector('.timestamp > .activityType').innerText,
                        isBoolean = grade.querySelector('.gradeStatus > span > span'),
                        score = isBoolean ? isBoolean.innerText : grade.querySelector('.grade > .grade').innerText,
                        total = isBoolean ? 'No Total' : grade.querySelector('.pointsPossible').innerText.replace('/', '');


                    itemArr.push({title, due, type, submitted, status, score, total});
                });

                return Promise.resolve(itemArr);
            }, course);

            course.items = parsedGrades;
        }

    }
    catch (err) {
        console.error('Error parsing grades.\t', err);
        return await browser.close();
    }

    try {
        console.log(`Complete, ${courseData.length} courses scraped. Closing browser.`);
        await browser.close();
    }
    catch (err) {
        console.error('Error closing browser');
        return;
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