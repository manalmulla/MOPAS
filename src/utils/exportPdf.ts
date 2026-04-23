import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const exportToPdf = async (elementId: string, filename: string = 'MOPAS-Threat-Report.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found.`);
    return;
  }

  try {
    // Hide buttons or elements you don't want in the PDF before capture
    const exportBtn = element.querySelector('.export-btn') as HTMLElement;
    if (exportBtn) exportBtn.style.display = 'none';

    // Ensure the container is temporarily forced to a specific width to prevent layout issues
    const originalWidth = element.style.width;
    element.style.width = '800px'; 
    element.style.background = '#050a12'; // match var(--bg) to ensure readability

    const canvas = await html2canvas(element, {
      scale: 2, // higher resolution
      useCORS: true,
      backgroundColor: '#050a12'
    });

    // Restore hidden elements and styles
    if (exportBtn) exportBtn.style.display = '';
    element.style.width = originalWidth;
    element.style.background = '';

    const imgData = canvas.toDataURL('image/png');
    
    // Calculate PDF dimensions (A4 size)
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
  } catch (error) {
    console.error('Failed to export PDF:', error);
  }
};
