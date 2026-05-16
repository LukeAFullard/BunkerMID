const ExcelJS = require('exceljs');
const PptxGenJS = require('pptxgenjs');

async function createXlsx() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('My Sheet');
  sheet.addRow(['Project', 'Status']);
  sheet.addRow(['BunkerMID', 'Awesome']);
  await workbook.xlsx.writeFile('demo.xlsx');
}

async function createPptx() {
  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();
  slide.addText("Welcome to BunkerMID", { x: 1, y: 1, w: '80%', h: 1 });
  await pptx.writeFile({ fileName: 'demo.pptx' });
}

(async () => {
  await createXlsx();
  await createPptx();
})();
