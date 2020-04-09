const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const officeWorksAutomatorUrl = [
  "https://www.officeworks.com.au/shop/officeworks/Print-And-Copy-Create?type=upload",
  "&qty=1",
  "&size=A5",
  "&productname=bookletsretail",
  "&printcolour=CoverAndBodyInBlackAndWhite",
  "&category=bookletsparent",
  "&shellPartNumber=",
  "&sided=double",
  "&page=40",
  "&binding=MACHINE_BOOKLET",
  "&bodypaper=A4RECYCLED80GSM",
  "&coverpaper=A4RECYCLED80GSM",
  "&bodytotalsheet=A4B%26W2SIDEPRINT1-500",
  "&covertotalsheet=A4B%26W2SIDEPRINT1-500",
].join("");

const directoryPath = path.join("..", "walden pond editions");

const overallStartTime = Date.now();
(async () => {
  const filesToPrint = getFilesToPrintList(directoryPath);
  filesToPrint.forEach((f, i) => console.log(i, f));

  // Launch a headless browser instance of chromium, webkit or firefox
  const browser = await chromium.launch({
    executablePath:
      "C:/Users/ben/AppData/Local/Google/Chrome SxS/Application/chrome.exe",
    headless: false,
    args: ["--disable-web-security", "--allow-running-insecure-content"],
  });

  // Use the default browser context to create a new tab and navigate to URL
  const page = await browser.newPage();
  page.setDefaultTimeout(180 * 1000);
  // sign in ------------------------------------------------------------------
  await signIn(page);
  console.log("signed in");
  // for the moment, this tells us that we're on the home page
  await page.waitForSelector("div[data-at=covid-19-shopping-spree]");
  // upload ------------------------------------------------------------------

  for (let i = 0; i < filesToPrint.length; i++) {
    const pdfFilename = filesToPrint[i];
    console.log(`\n\nAbout to print: ${pdfFilename}`);
    await uploadDoc(page, pdfFilename);
    // can't do await inside a forEach,
    // see https://zellwk.com/blog/async-await-in-loops/
  }
  //   await browser.close();
  console.log(
    "nice one, now just pay for it!",
    `that took ${(Date.now() - overallStartTime) / (60 * 1000)} minutes`
  );
})();

async function uploadDoc(page, pdfFilename) {
  // console.log("off we go\n\n", officeWorksAutomatorUrl);
  await page.goto(officeWorksAutomatorUrl);

  console.log("on the upload page");
  let filename = path.join(directoryPath, pdfFilename);
  console.log(`Now printing: ${filename}`);
  //   await handle.setInputFiles(filename);
  page.on("filechooser", async ({ element, multiple }) => {
    await element.setInputFiles(filename);
  });
  page.evaluate(() => {
    let ifr = Array.from(document.querySelectorAll("iframe"))[0];
    console.log(ifr);
    let el = ifr.contentDocument.querySelector(
      "#uploadifive-file_upload1 > input[type=file]:nth-child(2)"
    );
    console.log(el);
    el.click();
  });
  let timeAtStartOfUpload = Date.now();
  console.log("file uploading", timeAtStartOfUpload);
  await page.screenshot({ path: "loading.png" });
  page.setDefaultTimeout(20 * 1000);
  /*   The selector for the button, once it's ready to click is:
       "a.addtocart:not(.inactive)";
       but, because of iframes, I have no idea at all how to make this work, 
       I'm just waiting a fixed amount of time. like a chump. */
  await page.evaluate(
    ([x, n]) =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(x);
        }, n * 1000);
      }),
    ["feeeeenished", 90]
  );
  console.log(
    `finished uploading ${Date.now() - timeAtStartOfUpload} seconds later`
  ); // 90ish, I guess! :(
  await page.screenshot({ path: "uploaded.png" });
  await page.evaluate(() =>
    document
      .querySelectorAll("iframe")[0]
      .contentDocument.querySelector("a.addtocart") //"a.addtocart:not(.inactive)"
      .click()
  );
  await page.waitForSelector("a[title='Create Another']");
  await page.$('text="Your Booklets have been added to the cart"');
  await page.screenshot({ path: "loaded.png" });
  console.log(`finished with ${pdfFilename}`);
}

async function signIn(page) {
  await page.goto("https://www.officeworks.com.au/app/identity/login");
  const o = { delay: 10 };
  await page.type("input[name=username]", process.env.OFFICEWORKS_USERNAME, o);
  await page.type("input[name=password]", process.env.OFFICEWORKS_PASSWORD, o);
  await page.click("button[type=submit]");
}

function getFilesToPrintList(directoryPath) {
  let theFiles = fs
    .readdirSync(directoryPath)
    .filter((f) => f.includes(".pdf"));
  return theFiles;
}
