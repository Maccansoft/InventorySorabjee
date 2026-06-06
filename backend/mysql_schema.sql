-- MACCANSOFT FA SYSTEM - Production Master Schema

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- 1. LOCATIONS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `locations` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL,
    `is_ho` tinyint(1) DEFAULT 0,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `is_head_office` tinyint(1) DEFAULT 0,
    `is_active` tinyint(1) DEFAULT 1,
    `code` varchar(20) NOT NULL DEFAULT 'XX',
    PRIMARY KEY (`id`),
    UNIQUE KEY `name` (`name`),
    UNIQUE KEY `uq_loc_name` (`name`),
    INDEX `idx_loc_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 2. FISCAL YEARS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fiscal_years` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `label` varchar(50) DEFAULT NULL,
    `start_date` date NOT NULL,
    `end_date` date NOT NULL,
    `is_active` tinyint(1) DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `is_closed` tinyint(1) DEFAULT 0,
    `closed_at` timestamp NULL DEFAULT NULL,
    `year_name` varchar(50) GENERATED ALWAYS AS (`label`) VIRTUAL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `year_name` (`label`),
    INDEX `idx_fy_active` (`is_active`, `is_closed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 3. USERS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `username` varchar(50) NOT NULL,
    `password` varchar(255) NOT NULL,
    `role` enum('SUPER_ADMIN','ADMIN','USER') DEFAULT 'USER',
    `can_view_all` tinyint(1) DEFAULT 0,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `full_name` varchar(200) DEFAULT NULL,
    `location_id` int(11) DEFAULT NULL,
    `is_active` tinyint(1) DEFAULT 1,
    `created_by` int(11) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 4. USER ROLES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_roles` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `user_id` int(11) NOT NULL,
    `permission` varchar(100) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `user_id` (`user_id`),
    INDEX `idx_ur_user` (`user_id`),
    CONSTRAINT `user_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 5. CHART OF ACCOUNTS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `chart_of_accounts` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `location_id` int(11) DEFAULT NULL,
    `account_code` varchar(50) NOT NULL,
    `account_name` varchar(150) NOT NULL,
    `parent_id` int(11) DEFAULT NULL,
    `account_type` varchar(50) NOT NULL,
    `level` int(11) NOT NULL DEFAULT 1,
    `is_main` tinyint(1) DEFAULT 0,
    `is_active` tinyint(1) DEFAULT 1,
    `statement_type` enum('BALANCE_SHEET','PROFIT_LOSS','BOTH') DEFAULT 'BALANCE_SHEET',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `inventory_module` enum('STOCK_PURCHASE','PURCHASE_RETURN','SALES_INVOICE','SALES_RETURN','RECEIVABLES','PAYABLES','NONE') DEFAULT 'NONE',
    `created_by` int(11) DEFAULT NULL,
    PRIMARY KEY (`id`),
    INDEX `fk_parent_account` (`parent_id`),
    INDEX `fk_location_coa` (`location_id`),
    INDEX `idx_account_code_location` (`account_code`, `location_id`),
    INDEX `fk_coa_creator` (`created_by`),
    INDEX `idx_coa_parent` (`parent_id`),
    INDEX `idx_coa_type` (`account_type`),
    CONSTRAINT `fk_coa_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_coa_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_location_coa` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_parent_account` FOREIGN KEY (`parent_id`) REFERENCES `chart_of_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 6. VOUCHERS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `vouchers` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `location_id` int(11) DEFAULT NULL,
    `fiscal_year_id` int(11) DEFAULT NULL,
    `voucher_no` varchar(50) DEFAULT NULL,
    `voucher_type` enum('PAYMENT','RECEIPT','JOURNAL') DEFAULT NULL,
    `date` date DEFAULT NULL,
    `description` text DEFAULT NULL,
    `cheque_no` varchar(50) DEFAULT NULL,
    `cheque_date` varchar(50) DEFAULT NULL,
    `bank_name` varchar(255) DEFAULT NULL,
    `paid_by` varchar(255) DEFAULT NULL,
    `total_amount` decimal(15,2) DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `sequence_no` int(11) DEFAULT 1,
    `transaction_type` varchar(20) DEFAULT NULL,
    `location_code` varchar(20) DEFAULT NULL,
    `fiscal_year_label` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `voucher_no` (`voucher_no`),
    INDEX `fk_location_voucher` (`location_id`),
    INDEX `fk_fy_voucher` (`fiscal_year_id`),
    CONSTRAINT `fk_fy_voucher` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_location_voucher` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 7. VOUCHER ENTRIES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `voucher_entries` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `voucher_id` int(11) DEFAULT NULL,
    `account_id` int(11) DEFAULT NULL,
    `dr_amount` decimal(15,2) DEFAULT 0.00,
    `cr_amount` decimal(15,2) DEFAULT 0.00,
    `description` text DEFAULT NULL,
    PRIMARY KEY (`id`),
    INDEX `voucher_id` (`voucher_id`),
    INDEX `account_id` (`account_id`),
    INDEX `idx_ve_vouch` (`voucher_id`),
    INDEX `idx_ve_acc` (`account_id`),
    CONSTRAINT `fk_ve_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `voucher_entries_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 8. OPENING BALANCES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `opening_balances` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `fiscal_year_id` int(11) NOT NULL,
    `account_id` int(11) NOT NULL,
    `location_id` int(11) NOT NULL,
    `opening_balance` decimal(15,2) DEFAULT 0.00,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `sequence_no` int(11) DEFAULT 1,
    `transaction_type` varchar(20) DEFAULT 'STK',
    `location_code` varchar(20) DEFAULT NULL,
    `fiscal_year_label` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_fy_acc_loc` (`fiscal_year_id`, `account_id`, `location_id`),
    INDEX `account_id` (`account_id`),
    INDEX `location_id` (`location_id`),
    CONSTRAINT `opening_balances_ibfk_1` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `opening_balances_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `opening_balances_ibfk_3` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 9. COMPANY INFO
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_info` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `CompanyName` varchar(255) NOT NULL,
    `Address` text DEFAULT NULL,
    `Contact` varchar(100) DEFAULT NULL,
    `Email` varchar(100) DEFAULT NULL,
    `NTNo` varchar(50) DEFAULT NULL,
    `GSTNo` varchar(50) DEFAULT NULL,
    `GovtNo` varchar(50) DEFAULT NULL,
    `IATACode` varchar(50) DEFAULT NULL,
    `FaxNo` varchar(100) DEFAULT NULL,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `Tel` varchar(100) DEFAULT NULL,
    `Fax` varchar(100) DEFAULT NULL,
    `NTN` varchar(50) DEFAULT NULL,
    `GST` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_company_name` (`CompanyName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 10. COMPANY LOCATION INFO
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_location_info` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `company_id` int(11) NOT NULL,
    `location_id` int(11) NOT NULL,
    `Address` text DEFAULT NULL,
    `Contact` varchar(100) DEFAULT NULL,
    `Email` varchar(100) DEFAULT NULL,
    `NTNo` varchar(50) DEFAULT NULL,
    `GSTNo` varchar(50) DEFAULT NULL,
    `GovtNo` varchar(50) DEFAULT NULL,
    `IATACode` varchar(50) DEFAULT NULL,
    `FaxNo` varchar(100) DEFAULT NULL,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_comp_loc` (`company_id`, `location_id`),
    INDEX `location_id` (`location_id`),
    CONSTRAINT `company_location_info_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `company_info` (`id`) ON DELETE CASCADE,
    CONSTRAINT `company_location_info_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 11. MAKERS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `makers` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(150) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 12. CATEGORIES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(150) NOT NULL,
    `description` text DEFAULT NULL,
    `maker_id` int(11) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `rate` decimal(15,2) DEFAULT 0.00,
    PRIMARY KEY (`id`),
    INDEX `maker_id` (`maker_id`),
    CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 13. POWERS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `powers` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `power` varchar(100) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `power` (`power`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 14. SUPPLIERS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `suppliers` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(150) NOT NULL,
    `contact_person` varchar(150) DEFAULT NULL,
    `mobile` varchar(20) DEFAULT NULL,
    `phone` varchar(20) DEFAULT NULL,
    `fax` varchar(20) DEFAULT NULL,
    `email` varchar(100) DEFAULT NULL,
    `address` text DEFAULT NULL,
    `ntn` varchar(50) DEFAULT NULL,
    `gst` varchar(50) DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `location_id` int(11) DEFAULT NULL,
    PRIMARY KEY (`id`),
    INDEX `fk_supplier_location` (`location_id`),
    CONSTRAINT `fk_supplier_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 15. CUSTOMERS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(150) NOT NULL,
    `contact_person` varchar(150) DEFAULT NULL,
    `mobile` varchar(20) DEFAULT NULL,
    `phone` varchar(20) DEFAULT NULL,
    `fax` varchar(20) DEFAULT NULL,
    `email` varchar(100) DEFAULT NULL,
    `address` text DEFAULT NULL,
    `ntn` varchar(50) DEFAULT NULL,
    `gst` varchar(50) DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `location_id` int(11) DEFAULT NULL,
    PRIMARY KEY (`id`),
    INDEX `fk_customer_location` (`location_id`),
    INDEX `idx_customers_location` (`location_id`),
    CONSTRAINT `fk_customer_location` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 16. STOCK OPENING BALANCES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_opening_balances` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `trans_no` varchar(50) DEFAULT NULL,
    `trans_date` date DEFAULT NULL,
    `maker_id` int(11) NOT NULL,
    `category_id` int(11) DEFAULT NULL,
    `power_id` int(11) DEFAULT NULL,
    `lot_no` varchar(100) DEFAULT NULL,
    `sno` varchar(100) DEFAULT NULL,
    `serial_no` varchar(100) DEFAULT NULL,
    `qty` decimal(15,2) DEFAULT 0.00,
    `rate` decimal(15,2) DEFAULT 0.00,
    `amount` decimal(15,2) DEFAULT 0.00,
    `location_id` int(11) NOT NULL,
    `fiscal_year_id` int(11) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `exp_date` date DEFAULT NULL,
    `mfg_date` date DEFAULT NULL,
    `sequence_no` int(11) DEFAULT 1,
    `transaction_type` varchar(20) DEFAULT 'STK',
    `location_code` varchar(20) DEFAULT NULL,
    `fiscal_year_label` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    INDEX `maker_id` (`maker_id`),
    INDEX `category_id` (`category_id`),
    INDEX `power_id` (`power_id`),
    INDEX `location_id` (`location_id`),
    INDEX `fiscal_year_id` (`fiscal_year_id`),
    CONSTRAINT `stock_opening_balances_ibfk_1` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `stock_opening_balances_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `stock_opening_balances_ibfk_3` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `stock_opening_balances_ibfk_4` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `stock_opening_balances_ibfk_5` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 17. PURCHASES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchases` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `trans_no` varchar(50) DEFAULT NULL,
    `trans_date` date NOT NULL,
    `supplier_id` int(11) DEFAULT NULL,
    `total_amount` decimal(15,2) DEFAULT 0.00,
    `fiscal_year_id` int(11) NOT NULL,
    `user_id` int(11) NOT NULL,
    `location_id` int(11) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `voucher_id` int(11) DEFAULT NULL,
    `sequence_no` int(11) DEFAULT 1,
    `transaction_type` varchar(20) DEFAULT NULL,
    `location_code` varchar(20) DEFAULT NULL,
    `fiscal_year_label` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `trans_no` (`trans_no`),
    INDEX `supplier_id` (`supplier_id`),
    INDEX `fiscal_year_id` (`fiscal_year_id`),
    INDEX `user_id` (`user_id`),
    INDEX `location_id` (`location_id`),
    INDEX `fk_purchase_voucher` (`voucher_id`),
    INDEX `idx_pur_fy` (`fiscal_year_id`),
    INDEX `idx_pur_loc` (`location_id`),
    INDEX `idx_pur_sup` (`supplier_id`),
    CONSTRAINT `fk_purchase_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `purchases_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `purchases_ibfk_2` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE CASCADE,
    CONSTRAINT `purchases_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `purchases_ibfk_4` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 18. PURCHASE DETAILS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_details` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `purchase_id` int(11) NOT NULL,
    `maker_id` int(11) NOT NULL,
    `category_id` int(11) NOT NULL,
    `power_id` int(11) DEFAULT NULL,
    `lot_no` varchar(100) DEFAULT NULL,
    `sno` varchar(100) DEFAULT NULL,
    `serial_no` varchar(100) DEFAULT NULL,
    `exp_date` date DEFAULT NULL,
    `mfg_date` date DEFAULT NULL,
    `qty` decimal(15,2) DEFAULT 0.00,
    `qty_in_hand` decimal(15,2) DEFAULT 0.00,
    `rate` decimal(15,2) DEFAULT 0.00,
    `amount` decimal(15,2) DEFAULT 0.00,
    `p_rate` varchar(50) DEFAULT '',
    PRIMARY KEY (`id`),
    INDEX `purchase_id` (`purchase_id`),
    INDEX `maker_id` (`maker_id`),
    INDEX `category_id` (`category_id`),
    INDEX `power_id` (`power_id`),
    INDEX `idx_pdet_pur` (`purchase_id`),
    INDEX `idx_pdet_maker` (`maker_id`),
    INDEX `idx_pdet_cat` (`category_id`),
    INDEX `idx_pdet_lot` (`lot_no`),
    CONSTRAINT `purchase_details_ibfk_1` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE,
    CONSTRAINT `purchase_details_ibfk_2` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `purchase_details_ibfk_3` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `purchase_details_ibfk_4` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 19. PURCHASE RETURNS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_returns` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `trans_no` varchar(50) DEFAULT NULL,
    `trans_date` date NOT NULL,
    `supplier_id` int(11) DEFAULT NULL,
    `total_amount` decimal(15,2) DEFAULT 0.00,
    `fiscal_year_id` int(11) NOT NULL,
    `user_id` int(11) NOT NULL,
    `location_id` int(11) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `voucher_id` int(11) DEFAULT NULL,
    `sequence_no` int(11) DEFAULT 1,
    `transaction_type` varchar(20) DEFAULT NULL,
    `location_code` varchar(20) DEFAULT NULL,
    `fiscal_year_label` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `trans_no` (`trans_no`),
    INDEX `supplier_id` (`supplier_id`),
    INDEX `fiscal_year_id` (`fiscal_year_id`),
    INDEX `user_id` (`user_id`),
    INDEX `location_id` (`location_id`),
    INDEX `fk_purchase_return_voucher` (`voucher_id`),
    CONSTRAINT `fk_purchase_return_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `purchase_returns_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `purchase_returns_ibfk_2` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE CASCADE,
    CONSTRAINT `purchase_returns_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `purchase_returns_ibfk_4` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 20. PURCHASE RETURN DETAILS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_return_details` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `purchase_return_id` int(11) NOT NULL,
    `maker_id` int(11) NOT NULL,
    `category_id` int(11) NOT NULL,
    `power_id` int(11) DEFAULT NULL,
    `lot_no` varchar(100) DEFAULT NULL,
    `sno` varchar(100) DEFAULT NULL,
    `serial_no` varchar(100) DEFAULT NULL,
    `exp_date` date DEFAULT NULL,
    `mfg_date` date DEFAULT NULL,
    `qty` decimal(15,2) DEFAULT 0.00,
    `qty_in_hand` decimal(15,2) DEFAULT 0.00,
    `rate` decimal(15,2) DEFAULT 0.00,
    `amount` decimal(15,2) DEFAULT 0.00,
    `p_rate` varchar(50) DEFAULT '',
    PRIMARY KEY (`id`),
    INDEX `purchase_return_id` (`purchase_return_id`),
    INDEX `maker_id` (`maker_id`),
    INDEX `category_id` (`category_id`),
    INDEX `power_id` (`power_id`),
    CONSTRAINT `purchase_return_details_ibfk_1` FOREIGN KEY (`purchase_return_id`) REFERENCES `purchase_returns` (`id`) ON DELETE CASCADE,
    CONSTRAINT `purchase_return_details_ibfk_2` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `purchase_return_details_ibfk_3` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `purchase_return_details_ibfk_4` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 21. SALES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `trans_no` varchar(50) DEFAULT NULL,
    `trans_date` date NOT NULL,
    `customer_id` int(11) DEFAULT NULL,
    `total_amount` decimal(15,2) DEFAULT 0.00,
    `fiscal_year_id` int(11) NOT NULL,
    `user_id` int(11) NOT NULL,
    `location_id` int(11) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `voucher_id` int(11) DEFAULT NULL,
    `sequence_no` int(11) DEFAULT 1,
    `transaction_type` varchar(20) DEFAULT NULL,
    `location_code` varchar(20) DEFAULT NULL,
    `fiscal_year_label` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `trans_no` (`trans_no`),
    INDEX `customer_id` (`customer_id`),
    INDEX `fiscal_year_id` (`fiscal_year_id`),
    INDEX `user_id` (`user_id`),
    INDEX `location_id` (`location_id`),
    INDEX `fk_sales_voucher` (`voucher_id`),
    INDEX `idx_sle_fy` (`fiscal_year_id`),
    INDEX `idx_sle_loc` (`location_id`),
    INDEX `idx_sle_cust` (`customer_id`),
    CONSTRAINT `fk_sales_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE CASCADE,
    CONSTRAINT `sales_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `sales_ibfk_4` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 22. SALES DETAILS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_details` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `sale_id` int(11) NOT NULL,
    `maker_id` int(11) NOT NULL,
    `category_id` int(11) NOT NULL,
    `power_id` int(11) DEFAULT NULL,
    `lot_no` varchar(100) DEFAULT NULL,
    `sno` varchar(100) DEFAULT NULL,
    `serial_no` varchar(100) DEFAULT NULL,
    `exp_date` date DEFAULT NULL,
    `mfg_date` date DEFAULT NULL,
    `qty` decimal(15,2) DEFAULT 0.00,
    `qty_in_hand` decimal(15,2) DEFAULT 0.00,
    `rate` decimal(15,2) DEFAULT 0.00,
    `amount` decimal(15,2) DEFAULT 0.00,
    `p_rate` varchar(50) DEFAULT '',
    PRIMARY KEY (`id`),
    INDEX `sale_id` (`sale_id`),
    INDEX `maker_id` (`maker_id`),
    INDEX `category_id` (`category_id`),
    INDEX `power_id` (`power_id`),
    INDEX `idx_sdet_sale` (`sale_id`),
    INDEX `idx_sdet_maker` (`maker_id`),
    INDEX `idx_sdet_cat` (`category_id`),
    INDEX `idx_sdet_lot` (`lot_no`),
    CONSTRAINT `sales_details_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
    CONSTRAINT `sales_details_ibfk_2` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `sales_details_ibfk_3` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `sales_details_ibfk_4` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 23. SALES RETURNS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_returns` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `trans_no` varchar(50) DEFAULT NULL,
    `trans_date` date NOT NULL,
    `customer_id` int(11) DEFAULT NULL,
    `total_amount` decimal(15,2) DEFAULT 0.00,
    `fiscal_year_id` int(11) NOT NULL,
    `user_id` int(11) NOT NULL,
    `location_id` int(11) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `voucher_id` int(11) DEFAULT NULL,
    `sequence_no` int(11) DEFAULT 1,
    `transaction_type` varchar(20) DEFAULT NULL,
    `location_code` varchar(20) DEFAULT NULL,
    `fiscal_year_label` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `trans_no` (`trans_no`),
    INDEX `customer_id` (`customer_id`),
    INDEX `fiscal_year_id` (`fiscal_year_id`),
    INDEX `user_id` (`user_id`),
    INDEX `location_id` (`location_id`),
    INDEX `fk_sales_return_voucher` (`voucher_id`),
    CONSTRAINT `fk_sales_return_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `sales_returns_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
    CONSTRAINT `sales_returns_ibfk_2` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE CASCADE,
    CONSTRAINT `sales_returns_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `sales_returns_ibfk_4` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 24. SALES RETURN DETAILS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_return_details` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `sales_return_id` int(11) NOT NULL,
    `maker_id` int(11) NOT NULL,
    `category_id` int(11) NOT NULL,
    `power_id` int(11) DEFAULT NULL,
    `lot_no` varchar(100) DEFAULT NULL,
    `sno` varchar(100) DEFAULT NULL,
    `exp_date` date DEFAULT NULL,
    `mfg_date` date DEFAULT NULL,
    `qty` decimal(15,2) DEFAULT 0.00,
    `qty_in_hand` decimal(15,2) DEFAULT 0.00,
    `qty_sold` decimal(15,2) DEFAULT 0.00,
    `rate` decimal(15,2) DEFAULT 0.00,
    `amount` decimal(15,2) DEFAULT 0.00,
    `p_rate` varchar(50) DEFAULT '',
    PRIMARY KEY (`id`),
    INDEX `sales_return_id` (`sales_return_id`),
    INDEX `maker_id` (`maker_id`),
    INDEX `category_id` (`category_id`),
    INDEX `power_id` (`power_id`),
    CONSTRAINT `sales_return_details_ibfk_1` FOREIGN KEY (`sales_return_id`) REFERENCES `sales_returns` (`id`) ON DELETE CASCADE,
    CONSTRAINT `sales_return_details_ibfk_2` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `sales_return_details_ibfk_3` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `sales_return_details_ibfk_4` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 25. BARCODE MASTER
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `barcode_master` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `barcode` varchar(150) NOT NULL,
    `lot_no` varchar(100) DEFAULT NULL,
    `sno` varchar(100) DEFAULT NULL,
    `exp_date` date DEFAULT NULL,
    `mfg_date` date DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `barcode` (`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 26. SALES INVOICE RATES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_invoice_rates` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `a_rate` decimal(15,2) DEFAULT 0.00,
    `b_rate` decimal(15,2) DEFAULT 0.00,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 27. JOURNAL ENTRIES
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `journal_entries` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `entry_date` date NOT NULL,
    `reference_no` varchar(50) DEFAULT NULL,
    `description` text DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `location_id` int(11) DEFAULT NULL,
    `fiscal_year_id` int(11) DEFAULT NULL,
    PRIMARY KEY (`id`),
    INDEX (`entry_date`),
    INDEX (`location_id`),
    INDEX (`fiscal_year_id`),
    CONSTRAINT `fk_je_loc` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_je_fy` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 28. JOURNAL ENTRY DETAILS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `journal_entry_details` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `journal_id` int(11) DEFAULT NULL,
    `account_id` int(11) DEFAULT NULL,
    `debit` decimal(15,2) DEFAULT 0.00,
    `credit` decimal(15,2) DEFAULT 0.00,
    PRIMARY KEY (`id`),
    INDEX `journal_id` (`journal_id`),
    INDEX `account_id` (`account_id`),
    CONSTRAINT `journal_entry_details_ibfk_1` FOREIGN KEY (`journal_id`) REFERENCES `journal_entries` (`id`) ON DELETE CASCADE,
    CONSTRAINT `journal_entry_details_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 29. TRANSFER REQUESTS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transfer_requests` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `trans_no` varchar(50) DEFAULT NULL,
    `trans_date` date NOT NULL,
    `location_id` int(11) NOT NULL,
    `from_location_id` int(11) DEFAULT NULL,
    `to_location_id` int(11) DEFAULT NULL,
    `stock_req_no` varchar(255) DEFAULT NULL,
    `fiscal_year_id` int(11) NOT NULL,
    `user_id` int(11) NOT NULL,
    `total_qty` decimal(15,2) DEFAULT 0.00,
    `status` enum('PENDING','TRANSFERRED','TRANSFER','CANCELLED') DEFAULT 'PENDING',
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `notification_seen` tinyint(4) DEFAULT 0,
    `sequence_no` int(11) DEFAULT 1,
    `transaction_type` varchar(20) DEFAULT 'TRQ',
    `location_code` varchar(20) DEFAULT NULL,
    `fiscal_year_label` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `trans_no` (`trans_no`),
    INDEX `fiscal_year_id` (`fiscal_year_id`),
    INDEX `user_id` (`user_id`),
    INDEX `location_id` (`location_id`),
    INDEX `fk_trq_from_loc` (`from_location_id`),
    INDEX `fk_trq_to_loc` (`to_location_id`),
    CONSTRAINT `fk_trq_from_loc` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_trq_to_loc` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `transfer_requests_ibfk_1` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE CASCADE,
    CONSTRAINT `transfer_requests_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `transfer_requests_ibfk_3` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 30. TRANSFER REQUEST DETAILS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transfer_request_details` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `request_id` int(11) NOT NULL,
    `maker_id` int(11) NOT NULL,
    `category_id` int(11) NOT NULL,
    `power_id` int(11) DEFAULT NULL,
    `stock_received` decimal(15,2) DEFAULT 0.00,
    `stock_required` int(11) NOT NULL DEFAULT 0,
    `qty` decimal(15,2) DEFAULT 0.00,
    `qty_in_hand` decimal(15,2) DEFAULT 0.00,
    `lot_no` varchar(100) DEFAULT NULL,
    `sno` varchar(100) DEFAULT NULL,
    `exp_date` date DEFAULT NULL,
    `mfg_date` date DEFAULT NULL,
    PRIMARY KEY (`id`),
    INDEX `request_id` (`request_id`),
    INDEX `maker_id` (`maker_id`),
    INDEX `category_id` (`category_id`),
    INDEX `power_id` (`power_id`),
    CONSTRAINT `transfer_request_details_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `transfer_requests` (`id`) ON DELETE CASCADE,
    CONSTRAINT `transfer_request_details_ibfk_2` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transfer_request_details_ibfk_3` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transfer_request_details_ibfk_4` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 31. TRANSFERS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transfers` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `trans_no` varchar(50) DEFAULT NULL,
    `stock_req_no` varchar(255) DEFAULT NULL,
    `trans_date` date NOT NULL,
    `from_location_id` int(11) DEFAULT NULL,
    `to_location_id` int(11) DEFAULT NULL,
    `total_amount` decimal(15,2) DEFAULT 0.00,
    `fiscal_year_id` int(11) NOT NULL,
    `user_id` int(11) NOT NULL,
    `location_id` int(11) NOT NULL,
    `transfer_request_id` int(11) DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `sequence_no` int(11) DEFAULT 1,
    `transaction_type` varchar(20) DEFAULT NULL,
    `location_code` varchar(20) DEFAULT NULL,
    `fiscal_year_label` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `trans_no` (`trans_no`),
    INDEX `from_location_id` (`from_location_id`),
    INDEX `to_location_id` (`to_location_id`),
    INDEX `fiscal_year_id` (`fiscal_year_id`),
    INDEX `user_id` (`user_id`),
    INDEX `location_id` (`location_id`),
    INDEX `fk_transfer_request` (`transfer_request_id`),
    CONSTRAINT `fk_transfer_request` FOREIGN KEY (`transfer_request_id`) REFERENCES `transfer_requests` (`id`) ON DELETE SET NULL,
    CONSTRAINT `transfers_ibfk_1` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `transfers_ibfk_2` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `transfers_ibfk_3` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE CASCADE,
    CONSTRAINT `transfers_ibfk_4` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `transfers_ibfk_5` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 32. TRANSFER DETAILS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transfer_details` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `transfer_id` int(11) NOT NULL,
    `maker_id` int(11) NOT NULL,
    `category_id` int(11) NOT NULL,
    `power_id` int(11) DEFAULT NULL,
    `stock_required` int(11) NOT NULL DEFAULT 0,
    `stock_req` varchar(255) DEFAULT NULL,
    `barcode` varchar(100) DEFAULT NULL,
    `lot_no` varchar(100) DEFAULT NULL,
    `sno` varchar(100) DEFAULT NULL,
    `serial_no` varchar(100) DEFAULT NULL,
    `exp_date` date DEFAULT NULL,
    `mfg_date` date DEFAULT NULL,
    `qty` decimal(15,2) DEFAULT 0.00,
    `qty_in_hand` decimal(15,2) DEFAULT 0.00,
    `rate` decimal(15,2) DEFAULT 0.00,
    `amount` decimal(15,2) DEFAULT 0.00,
    PRIMARY KEY (`id`),
    INDEX `transfer_id` (`transfer_id`),
    INDEX `maker_id` (`maker_id`),
    INDEX `category_id` (`category_id`),
    INDEX `power_id` (`power_id`),
    INDEX `idx_transfer_barcode` (`barcode`),
    INDEX `idx_transfer_lot_no` (`lot_no`),
    CONSTRAINT `transfer_details_ibfk_1` FOREIGN KEY (`transfer_id`) REFERENCES `transfers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `transfer_details_ibfk_2` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transfer_details_ibfk_3` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transfer_details_ibfk_4` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 33. BARCODE FORMATS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `barcode_formats` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `name` varchar(100) NOT NULL,
    `manufacturer` varchar(100) DEFAULT NULL,
    `pattern_type` enum('regex','fixed','gs1') DEFAULT 'regex',
    `pattern_expression` text DEFAULT NULL,
    `example_barcode` text DEFAULT NULL,
    `is_active` tinyint(1) DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 34. BARCODE FORMAT SETUP
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `barcode_format_setup` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `format_type` varchar(100) DEFAULT NULL,
    `maker_id` int(11) DEFAULT NULL,
    `sample_barcode` text DEFAULT NULL,
    `lot_no` varchar(100) DEFAULT NULL,
    `sno` varchar(100) DEFAULT NULL,
    `exp_date` date DEFAULT NULL,
    `mfg_years_less` int(11) DEFAULT 3,
    `is_active` tinyint(1) DEFAULT 1,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `fk_barcode_setup_maker` (`maker_id`),
    CONSTRAINT `fk_barcode_setup_maker` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 35. STOCK RETURNS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_returns` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `trans_no` varchar(50) NOT NULL,
    `trans_date` date NOT NULL,
    `from_location_id` int(11) NOT NULL,
    `to_location_id` int(11) NOT NULL,
    `original_trans_no` varchar(50) NOT NULL,
    `remarks` text DEFAULT NULL,
    `user_id` int(11) NOT NULL,
    `fiscal_year_id` int(11) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `sequence_no` int(11) DEFAULT 1,
    `transaction_type` varchar(20) DEFAULT 'SRT',
    `location_code` varchar(20) DEFAULT NULL,
    `fiscal_year_label` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `trans_no` (`trans_no`),
    INDEX `from_location_id` (`from_location_id`),
    INDEX `to_location_id` (`to_location_id`),
    INDEX `fiscal_year_id` (`fiscal_year_id`),
    INDEX `user_id` (`user_id`),
    CONSTRAINT `stock_returns_ibfk_1` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE,
    CONSTRAINT `stock_returns_ibfk_2` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE,
    CONSTRAINT `stock_returns_ibfk_3` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE CASCADE,
    CONSTRAINT `stock_returns_ibfk_4` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 36. STOCK RETURN DETAILS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_return_details` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `return_id` int(11) NOT NULL,
    `maker_id` int(11) NOT NULL,
    `category_id` int(11) NOT NULL,
    `power_id` int(11) DEFAULT NULL,
    `barcode` varchar(100) NOT NULL,
    `lot_no` varchar(100) DEFAULT NULL,
    `sno` varchar(100) DEFAULT NULL,
    `mfg_date` date DEFAULT NULL,
    `exp_date` date DEFAULT NULL,
    `qty` decimal(15,2) DEFAULT 0.00,
    `rate` decimal(15,2) DEFAULT 0.00,
    `amount` decimal(15,2) DEFAULT 0.00,
    PRIMARY KEY (`id`),
    INDEX `return_id` (`return_id`),
    INDEX `maker_id` (`maker_id`),
    INDEX `category_id` (`category_id`),
    INDEX `power_id` (`power_id`),
    CONSTRAINT `stock_return_details_ibfk_1` FOREIGN KEY (`return_id`) REFERENCES `stock_returns` (`id`) ON DELETE CASCADE,
    CONSTRAINT `stock_return_details_ibfk_2` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `stock_return_details_ibfk_3` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `stock_return_details_ibfk_4` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 37. STOCK TRANSFER RETURNS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_transfer_returns` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `trans_no` varchar(50) NOT NULL,
    `trans_date` date NOT NULL,
    `original_transfer_ref` varchar(50) NOT NULL,
    `original_sending_location_id` int(11) NOT NULL,
    `location_id` int(11) NOT NULL,
    `fiscal_year_id` int(11) NOT NULL,
    `user_id` int(11) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `sequence_no` int(11) DEFAULT 1,
    `transaction_type` varchar(20) DEFAULT 'SRT',
    `location_code` varchar(20) DEFAULT NULL,
    `fiscal_year_label` varchar(50) DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `trans_no` (`trans_no`),
    INDEX `location_id` (`location_id`, `fiscal_year_id`),
    INDEX `fk_str_sending_loc` (`original_sending_location_id`),
    INDEX `fk_str_fy` (`fiscal_year_id`),
    INDEX `fk_str_user` (`user_id`),
    CONSTRAINT `fk_str_fy` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_str_loc` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_str_sending_loc` FOREIGN KEY (`original_sending_location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_str_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 38. STOCK TRANSFER RETURN ITEMS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_transfer_return_items` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `return_id` int(11) NOT NULL,
    `barcode` varchar(150) DEFAULT NULL,
    `maker_id` int(11) NOT NULL,
    `category_id` int(11) NOT NULL,
    `power_id` int(11) DEFAULT NULL,
    `lot_no` varchar(100) DEFAULT NULL,
    `sno` varchar(100) DEFAULT NULL,
    `mfg_date` date DEFAULT NULL,
    `exp_date` date DEFAULT NULL,
    `qty_received` decimal(15,2) DEFAULT 0.00,
    `qty_return` decimal(15,2) DEFAULT 0.00,
    PRIMARY KEY (`id`),
    INDEX `return_id` (`return_id`),
    INDEX `fk_stri_maker` (`maker_id`),
    INDEX `fk_stri_cat` (`category_id`),
    INDEX `fk_stri_power` (`power_id`),
    CONSTRAINT `fk_stri_cat` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_stri_header` FOREIGN KEY (`return_id`) REFERENCES `stock_transfer_returns` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_stri_maker` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_stri_power` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 39. TRANSACTIONS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transactions` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `trans_no` varchar(50) DEFAULT NULL,
    `trans_type` enum('PURCHASE','PURCHASE_RETURN','TRANSFER','SALES_INVOICE','SALES_RETURN') NOT NULL,
    `trans_date` date NOT NULL,
    `supplier_id` int(11) DEFAULT NULL,
    `customer_id` int(11) DEFAULT NULL,
    `from_location_id` int(11) DEFAULT NULL,
    `to_location_id` int(11) DEFAULT NULL,
    `total_amount` decimal(15,2) DEFAULT 0.00,
    `fiscal_year_id` int(11) NOT NULL,
    `user_id` int(11) NOT NULL,
    `location_id` int(11) NOT NULL,
    `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `trans_no` (`trans_no`),
    INDEX `supplier_id` (`supplier_id`),
    INDEX `customer_id` (`customer_id`),
    INDEX `from_location_id` (`from_location_id`),
    INDEX `to_location_id` (`to_location_id`),
    INDEX `fiscal_year_id` (`fiscal_year_id`),
    INDEX `user_id` (`user_id`),
    INDEX `location_id` (`location_id`),
    CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transactions_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transactions_ibfk_3` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transactions_ibfk_4` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transactions_ibfk_5` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transactions_ibfk_6` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transactions_ibfk_7` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 40. TRANSACTION DETAILS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `transaction_details` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `transaction_id` int(11) NOT NULL,
    `maker_id` int(11) NOT NULL,
    `category_id` int(11) NOT NULL,
    `power_id` int(11) DEFAULT NULL,
    `lot_no` varchar(100) DEFAULT NULL,
    `exp_date` date DEFAULT NULL,
    `mft_date` date DEFAULT NULL,
    `qty` decimal(15,2) DEFAULT 0.00,
    `rate` decimal(15,2) DEFAULT 0.00,
    `amount` decimal(15,2) DEFAULT 0.00,
    PRIMARY KEY (`id`),
    INDEX `transaction_id` (`transaction_id`),
    INDEX `maker_id` (`maker_id`),
    INDEX `category_id` (`category_id`),
    INDEX `power_id` (`power_id`),
    CONSTRAINT `transaction_details_ibfk_1` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE,
    CONSTRAINT `transaction_details_ibfk_2` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transaction_details_ibfk_3` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
    CONSTRAINT `transaction_details_ibfk_4` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;
