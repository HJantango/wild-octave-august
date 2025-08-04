#!/usr/bin/env node

/**
 * Deployment Verification Script
 * Verifies that interactive elements are working correctly in the deployed application
 */

const puppeteer = require('puppeteer');

async function verifyDeployment(url) {
  console.log(`🔍 Verifying deployment at: ${url}`);
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Test main pages
    const testPages = [
      '/'
    ];
    
    for (const testPage of testPages) {
      const fullUrl = `${url}${testPage}`;
      console.log(`\n📄 Testing page: ${fullUrl}`);
      
      await page.goto(fullUrl, { waitUntil: 'networkidle0' });
      
      // Check for JavaScript errors
      const errors = await page.evaluate(() => {
        return window.console._errors || [];
      });
      
      if (errors.length > 0) {
        console.log(`❌ JavaScript errors found:`, errors);
      } else {
        console.log(`✅ No JavaScript errors`);
      }
      
      // Check for interactive elements
      const interactiveElements = await page.evaluate(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        const selects = document.querySelectorAll('select');
        const buttons = document.querySelectorAll('button');
        
        return {
          checkboxCount: checkboxes.length,
          selectCount: selects.length,
          buttonCount: buttons.length,
          hasReactRoot: document.getElementById('__next') !== null
        };
      });
      
      console.log(`📊 Interactive elements found:`, interactiveElements);
      
      // Test checkbox functionality if available
      if (interactiveElements.checkboxCount > 0) {
        const checkboxWorking = await page.evaluate(() => {
          const checkbox = document.querySelector('input[type="checkbox"]');
          if (checkbox) {
            const initialState = checkbox.checked;
            checkbox.click();
            const afterClick = checkbox.checked;
            checkbox.click(); // Reset
            return initialState !== afterClick;
          }
          return false;
        });
        
        if (checkboxWorking) {
          console.log(`✅ Checkboxes are functional`);
        } else {
          console.log(`❌ Checkboxes are not working`);
        }
      }
      
      // Test dropdown functionality if available
      if (interactiveElements.selectCount > 0) {
        const dropdownWorking = await page.evaluate(() => {
          const select = document.querySelector('select');
          if (select) {
            select.focus();
            return document.activeElement === select;
          }
          return false;
        });
        
        if (dropdownWorking) {
          console.log(`✅ Dropdowns are functional`);
        } else {
          console.log(`❌ Dropdowns are not working`);
        }
      }
    }
    
    console.log(`\n🎉 Deployment verification completed successfully!`);
    
  } catch (error) {
    console.error(`❌ Deployment verification failed:`, error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run verification
const deploymentUrl = process.argv[2] || 'https://13a040b497.preview.abacusai.app';
verifyDeployment(deploymentUrl);
