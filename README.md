# wl-sql

A comprehensive SQL formatter extension for Visual Studio Code that automatically formats and standardizes your SQL code according to best practices.

## Features

wl-sql provides powerful SQL formatting capabilities with the following features:

- **Keyword Standardization**: Automatically converts all SQL keywords to uppercase (SELECT, FROM, WHERE, etc.)
- **Smart Identifier Bracketing**: Wraps database identifiers in square brackets while preserving table aliases and avoiding over-bracketing
- **Stored Procedure Formatting**: Properly formats stored procedure parameters with proper indentation and line breaks
- **Variable Formatting**: Converts variables to camelCase naming convention
- **WITH(NOLOCK) Management**: Automatically adds WITH(NOLOCK) hints where appropriate and cleans up duplicate hints
- **Parameter Formatting**: Formats stored procedure parameters with proper spacing and trailing commas
- **Smart Indentation**: Provides consistent indentation for nested SQL blocks
- **Spacing Normalization**: Ensures proper spacing around operators, commas, and keywords

### Before and After Example

**Before:**
```sql
create procedure dbo.GetCustomerData
@webId int,@username nvarchar(50)='',@page int=1
as
select customerid,username from customer c
left join orders o on o.customerid=c.customerid
where c.webid=@webId and c.username=@username
```

**After:**
```sql
CREATE PROCEDURE [dbo].[GetCustomerData]
	@webId INT,
	@username NVARCHAR(50) = '',
	@page INT = 1
AS
SELECT
	[CustomerId], [Username]
FROM [dbo].[Customer] c WITH(NOLOCK)
LEFT JOIN [dbo].[Orders] o WITH(NOLOCK)
	ON o.[CustomerId] = c.[CustomerId]
WHERE c.[WebId] = @webId
	AND c.[Username] = @username
```

## Requirements

- Visual Studio Code version 1.60.0 or higher
- No additional dependencies required

## Extension Settings

This extension contributes the following settings:

* `wl-sql.enable`: Enable/disable the wl-sql formatter
* `wl-sql.formatOnSave`: Automatically format SQL files when saving
* `wl-sql.decimalPrecision`: Set decimal precision format (default: DECIMAL(19,6))
* `wl-sql.addNoLock`: Automatically add WITH(NOLOCK) hints to table references
* `wl-sql.camelCaseVariables`: Convert variable names to camelCase

## Usage

### Format Current Document
- Open a SQL file (.sql extension)
- Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
- Type "Format Document" and press Enter
- Or use the keyboard shortcut `Shift+Alt+F` (Windows/Linux) or `Shift+Option+F` (macOS)

### Format Selection
- Select the SQL code you want to format
- Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
- Type "Format Selection" and press Enter

### Auto-format on Save
Enable the `wl-sql.formatOnSave` setting to automatically format your SQL files when saving.

## Known Issues

- Complex nested subqueries may require manual adjustment after formatting
- Some proprietary SQL extensions may not be fully supported
- Very large SQL files (>1MB) may experience slower formatting performance

## Release Notes

### 1.0.0
Initial release of wl-sql
- Basic SQL keyword formatting
- Identifier bracketing
- Stored procedure parameter formatting
- Variable camelCase conversion

### 1.0.1
- Fixed issue with double bracketing of identifiers
- Improved WITH(NOLOCK) duplicate detection
- Better handling of table aliases

### 1.1.0
- Added support for more SQL keywords
- Improved stored procedure formatting
- Enhanced spacing normalization
- Better error handling for malformed SQL

### 1.2.0
- Fixed ASBEGIN concatenation issues
- Improved decimal precision formatting
- Better detection of table aliases
- Enhanced parameter formatting for stored procedures

---

## Following Extension Guidelines

This extension follows the VS Code extension guidelines and best practices:

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Support

If you encounter any issues or have feature requests, please:

1. Check the [Known Issues](#known-issues) section first
2. Search existing issues in the repository
3. Create a new issue with detailed reproduction steps

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

**Enjoy formatting your SQL code with wl-sql!**
