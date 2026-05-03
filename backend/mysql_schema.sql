-- MACCANSOFT FA SYSTEM - MySQL Schema
-- Generated for transition to MySQL (mysql2)

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- 1. Locations
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `locations` (
    `id`             INT PRIMARY KEY AUTO_INCREMENT,
    `code`           VARCHAR(20)  NOT NULL UNIQUE,
    `name`           VARCHAR(150) NOT NULL,
    `is_head_office` BOOLEAN      DEFAULT FALSE,
    `is_active`      BOOLEAN      DEFAULT TRUE,
    `created_at`     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 2. Fiscal Years
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `fiscal_years` (
    `id`          INT PRIMARY KEY AUTO_INCREMENT,
    `label`       VARCHAR(20)  NOT NULL UNIQUE,
    `start_date`  DATE         NOT NULL,
    `end_date`    DATE         NOT NULL,
    `is_active`   BOOLEAN      DEFAULT TRUE,
    `is_closed`   BOOLEAN      DEFAULT FALSE,
    `closed_at`   TIMESTAMP    NULL,
    `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX (`is_active`, `is_closed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 3. Users
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id`          INT PRIMARY KEY AUTO_INCREMENT,
    `username`    VARCHAR(100) NOT NULL UNIQUE,
    `password`    VARCHAR(255) NOT NULL,
    `full_name`   VARCHAR(200),
    `role`        ENUM('SUPER_ADMIN','ADMIN','USER') DEFAULT 'USER',
    `location_id` INT          NULL,
    `is_active`   BOOLEAN      DEFAULT TRUE,
    `created_by`  INT          NULL,
    `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX (`location_id`),
    CONSTRAINT `fk_user_location` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 4. User Roles
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_roles` (
    `id`          INT PRIMARY KEY AUTO_INCREMENT,
    `user_id`     INT NOT NULL,
    `permission`  VARCHAR(100) NOT NULL,
    INDEX (`user_id`),
    CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 5. Chart of Accounts
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `chart_of_accounts` (
    `id`            INT PRIMARY KEY AUTO_INCREMENT,
    `account_code`  VARCHAR(50)  NOT NULL UNIQUE,
    `account_name`  VARCHAR(150) NOT NULL,
    `parent_id`     INT          NULL,
    `account_type`  VARCHAR(50)  NOT NULL,
    `level`         INT          NOT NULL DEFAULT 1,
    `is_main`       BOOLEAN      DEFAULT FALSE,
    `is_active`     BOOLEAN      DEFAULT TRUE,
    `statement_type` ENUM('BALANCE_SHEET', 'PROFIT_LOSS', 'BOTH') DEFAULT 'BALANCE_SHEET',
    `inventory_module` ENUM('STOCK_PURCHASE', 'PURCHASE_RETURN', 'SALES_INVOICE', 'SALES_RETURN', 'NONE') DEFAULT 'NONE',
    `location_id`   INT          NULL,
    `created_by`    INT          NULL,
    `created_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX (`parent_id`),
    INDEX (`location_id`),
    CONSTRAINT `fk_parent_account` FOREIGN KEY (`parent_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_coa_location` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_coa_creator` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 6. Vouchers
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `vouchers` (
    `id`            INT AUTO_INCREMENT PRIMARY KEY,
    `voucher_no`    VARCHAR(50)  UNIQUE,
    `voucher_type`  ENUM('PAYMENT','RECEIPT','JOURNAL'),
    `date`          DATE,
    `description`   TEXT,
    `cheque_no`     VARCHAR(50),
    `cheque_date`   VARCHAR(50),
    `bank_name`     VARCHAR(255),
    `paid_by`       VARCHAR(255),
    `total_amount`  DECIMAL(15,2),
    `location_id`   INT          NULL,
    `fiscal_year_id` INT         NULL,
    `sequence_no`   INT DEFAULT 1,
    `transaction_type` VARCHAR(20),
    `location_code` VARCHAR(20),
    `fiscal_year_label` VARCHAR(50),
    `created_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (`date`),
    INDEX (`location_id`, `fiscal_year_id`),
    CONSTRAINT `fk_voucher_location` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE RESTRICT,
    CONSTRAINT `fk_voucher_fy` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 7. Voucher Entries
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `voucher_entries` (
    `id`          INT AUTO_INCREMENT PRIMARY KEY,
    `voucher_id`  INT,
    `account_id`  INT,
    `dr_amount`   DECIMAL(15,2) DEFAULT 0,
    `cr_amount`   DECIMAL(15,2) DEFAULT 0,
    `description` TEXT,
    INDEX (`voucher_id`),
    INDEX (`account_id`),
    CONSTRAINT `fk_ve_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ve_account` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 8. Opening Balances (Accounting)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `opening_balances` (
    `id`             INT PRIMARY KEY AUTO_INCREMENT,
    `fiscal_year_id` INT NOT NULL,
    `account_id`     INT NOT NULL,
    `location_id`    INT NOT NULL,
    `opening_balance` DECIMAL(15,2) DEFAULT 0,
    `created_at`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_fy_acc_loc` (`fiscal_year_id`, `account_id`, `location_id`),
    CONSTRAINT `fk_ob_fy` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ob_acc` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ob_loc` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 9. Company Info
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_info` (
    `id`            INT PRIMARY KEY AUTO_INCREMENT,
    `CompanyName`   VARCHAR(255) NOT NULL,
    `Address`       TEXT,
    `Contact`       VARCHAR(100),
    `Email`         VARCHAR(100),
    `NTNo`          VARCHAR(50),
    `GSTNo`         VARCHAR(50),
    `GovtNo`        VARCHAR(50),
    `IATACode`      VARCHAR(50),
    `FaxNo`         VARCHAR(100),
    `updated_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 10. Inventory Masters
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `makers` (
    `id` INT PRIMARY KEY AUTO_INCREMENT, 
    `name` VARCHAR(150) NOT NULL UNIQUE, 
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT PRIMARY KEY AUTO_INCREMENT, 
    `name` VARCHAR(150) NOT NULL, 
    `maker_id` INT NOT NULL, 
    `rate` DECIMAL(15,2) DEFAULT 0, 
    `description` TEXT, 
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
    CONSTRAINT `fk_cat_maker` FOREIGN KEY (`maker_id`) REFERENCES `makers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `powers` (
    `id` INT PRIMARY KEY AUTO_INCREMENT, 
    `power` VARCHAR(100) NOT NULL UNIQUE, 
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `suppliers` (
    `id` INT PRIMARY KEY AUTO_INCREMENT, 
    `name` VARCHAR(150) NOT NULL, 
    `contact_person` VARCHAR(150), 
    `mobile` VARCHAR(20), 
    `phone` VARCHAR(20), 
    `fax` VARCHAR(20), 
    `email` VARCHAR(100), 
    `address` TEXT, 
    `ntn` VARCHAR(50), 
    `gst` VARCHAR(50), 
    `location_id` INT NULL, 
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
    CONSTRAINT `fk_sup_loc` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `customers` (
    `id` INT PRIMARY KEY AUTO_INCREMENT, 
    `name` VARCHAR(150) NOT NULL, 
    `contact_person` VARCHAR(150), 
    `mobile` VARCHAR(20), 
    `phone` VARCHAR(20), 
    `fax` VARCHAR(20), 
    `email` VARCHAR(100), 
    `address` TEXT, 
    `ntn` VARCHAR(50), 
    `gst` VARCHAR(50), 
    `location_id` INT NULL, 
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
    INDEX (`location_id`),
    CONSTRAINT `fk_cus_loc` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 11. Inventory Transactions
-- --------------------------------------------------------

-- 11a. Stock Opening Balances
CREATE TABLE IF NOT EXISTS `stock_opening_balances` (
    `id`             INT PRIMARY KEY AUTO_INCREMENT,
    `trans_no`       VARCHAR(50),
    `trans_date`     DATE,
    `maker_id`       INT NOT NULL,
    `category_id`    INT NOT NULL,
    `power_id`       INT,
    `lot_no`         VARCHAR(100),
    `sno`            VARCHAR(100),
    `qty`            DECIMAL(15,2) DEFAULT 0,
    `rate`           DECIMAL(15,2) DEFAULT 0,
    `amount`         DECIMAL(15,2) DEFAULT 0,
    `exp_date`       DATE,
    `mfg_date`       DATE,
    `location_id`    INT NOT NULL,
    `fiscal_year_id` INT NOT NULL,
    `created_at`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `sequence_no`    INT DEFAULT 1,
    `transaction_type` VARCHAR(20) DEFAULT 'STK',
    `location_code`  VARCHAR(20),
    `fiscal_year_label` VARCHAR(50),
    INDEX (`location_id`, `fiscal_year_id`),
    CONSTRAINT `fk_stk_maker` FOREIGN KEY (`maker_id`) REFERENCES `makers`(`id`),
    CONSTRAINT `fk_stk_cat` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`),
    CONSTRAINT `fk_stk_loc` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`),
    CONSTRAINT `fk_stk_fy` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 11b. Purchases
CREATE TABLE IF NOT EXISTS `purchases` (
    `id`             INT PRIMARY KEY AUTO_INCREMENT,
    `trans_no`       VARCHAR(50) UNIQUE,
    `trans_date`     DATE NOT NULL,
    `supplier_id`    INT NULL,
    `total_amount`   DECIMAL(15,2) DEFAULT 0,
    `voucher_id`     INT NULL,
    `fiscal_year_id` INT NOT NULL,
    `user_id`        INT NOT NULL,
    `location_id`    INT NOT NULL,
    `created_at`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `sequence_no`    INT DEFAULT 1,
    `transaction_type` VARCHAR(20),
    `location_code`  VARCHAR(20),
    `fiscal_year_label` VARCHAR(50),
    INDEX (`location_id`, `fiscal_year_id`),
    INDEX (`trans_date`),
    CONSTRAINT `fk_pur_sup` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_pur_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_pur_fy` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_pur_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_pur_loc` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `purchase_details` (
    `id`             INT PRIMARY KEY AUTO_INCREMENT,
    `purchase_id`    INT NOT NULL,
    `maker_id`       INT NOT NULL,
    `category_id`    INT NOT NULL,
    `power_id`       INT NULL,
    `lot_no`         VARCHAR(100),
    `sno`            VARCHAR(100),
    `exp_date`       DATE,
    `mfg_date`       DATE,
    `qty`            DECIMAL(15,2) DEFAULT 0,
    `qty_sold`       DECIMAL(15,2) DEFAULT 0,
    `rate`           DECIMAL(15,2) DEFAULT 0,
    `p_rate`         VARCHAR(50) DEFAULT '',
    `amount`         DECIMAL(15,2) DEFAULT 0,
    INDEX (`purchase_id`),
    CONSTRAINT `fk_pur_det_header` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_pur_det_maker` FOREIGN KEY (`maker_id`) REFERENCES `makers`(`id`),
    CONSTRAINT `fk_pur_det_cat` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 11c. Sales
CREATE TABLE IF NOT EXISTS `sales` (
    `id`             INT PRIMARY KEY AUTO_INCREMENT,
    `trans_no`       VARCHAR(50) UNIQUE,
    `trans_date`     DATE NOT NULL,
    `customer_id`    INT NULL,
    `total_amount`   DECIMAL(15,2) DEFAULT 0,
    `voucher_id`     INT NULL,
    `fiscal_year_id` INT NOT NULL,
    `user_id`        INT NOT NULL,
    `location_id`    INT NOT NULL,
    `created_at`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `sequence_no`    INT DEFAULT 1,
    `transaction_type` VARCHAR(20),
    `location_code`  VARCHAR(20),
    `fiscal_year_label` VARCHAR(50),
    INDEX (`location_id`, `fiscal_year_id`),
    INDEX (`trans_date`),
    CONSTRAINT `fk_sales_cust` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_sales_voucher` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_sales_fy` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sales_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sales_loc` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `sales_details` (
    `id`             INT PRIMARY KEY AUTO_INCREMENT,
    `sale_id`        INT NOT NULL,
    `maker_id`       INT NOT NULL,
    `category_id`    INT NOT NULL,
    `power_id`       INT NULL,
    `lot_no`         VARCHAR(100),
    `sno`            VARCHAR(100),
    `exp_date`       DATE,
    `mfg_date`       DATE,
    `qty`            DECIMAL(15,2) DEFAULT 0,
    `qty_sold`       DECIMAL(15,2) DEFAULT 0,
    `rate`           DECIMAL(15,2) DEFAULT 0,
    `p_rate`         VARCHAR(50) DEFAULT '',
    `amount`         DECIMAL(15,2) DEFAULT 0,
    INDEX (`sale_id`),
    CONSTRAINT `fk_sales_det_header` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sales_det_maker` FOREIGN KEY (`maker_id`) REFERENCES `makers`(`id`),
    CONSTRAINT `fk_sales_det_cat` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 12. Barcode & Rates
CREATE TABLE IF NOT EXISTS `barcode_master` (
    `id`         INT PRIMARY KEY AUTO_INCREMENT,
    `barcode`    VARCHAR(150) UNIQUE NOT NULL,
    `lot_no`     VARCHAR(100),
    `sno`        VARCHAR(100),
    `exp_date`   DATE,
    `mfg_date`   DATE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `sales_invoice_rates` (
    `id`         INT PRIMARY KEY AUTO_INCREMENT,
    `a_rate`     DECIMAL(15,2) DEFAULT 0,
    `b_rate`     DECIMAL(15,2) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 13. Journal Entries
CREATE TABLE IF NOT EXISTS `journal_entries` (
    `id`           INT PRIMARY KEY AUTO_INCREMENT,
    `entry_date`   DATE NOT NULL,
    `reference_no` VARCHAR(50),
    `description`  TEXT,
    `location_id`  INT,
    `fiscal_year_id` INT,
    `created_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (`entry_date`),
    CONSTRAINT `fk_je_loc` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_je_fy` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `journal_entry_details` (
    `id`         INT PRIMARY KEY AUTO_INCREMENT,
    `journal_id` INT,
    `account_id` INT,
    `debit`      DECIMAL(15,2) DEFAULT 0,
    `credit`     DECIMAL(15,2) DEFAULT 0,
    `description` TEXT,
    INDEX (`journal_id`),
    INDEX (`account_id`),
    CONSTRAINT `fk_jed_header` FOREIGN KEY (`journal_id`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_jed_account` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 14. Transfer Tables
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `transfer_requests` (
    `id`                INT PRIMARY KEY AUTO_INCREMENT,
    `trans_no`          VARCHAR(50) UNIQUE,
    `trans_date`        DATE NOT NULL,
    `location_id`       INT NOT NULL,
    `from_location_id`  INT NULL,
    `to_location_id`    INT NULL,
    `stock_req_no`      VARCHAR(255) NULL,
    `fiscal_year_id`    INT NOT NULL,
    `user_id`           INT NOT NULL,
    `total_qty`         DECIMAL(15,2) DEFAULT 0.00,
    `status`            ENUM('PENDING','TRANSFERRED','TRANSFER','CANCELLED') DEFAULT 'PENDING',
    `created_at`        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `notification_seen` TINYINT(4) DEFAULT 0,
    `sequence_no`       INT DEFAULT 1,
    `transaction_type`  VARCHAR(20) DEFAULT 'TRQ',
    `location_code`     VARCHAR(20),
    `fiscal_year_label` VARCHAR(50),
    INDEX (`fiscal_year_id`),
    INDEX (`user_id`),
    INDEX (`location_id`),
    CONSTRAINT `fk_trq_from_loc` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_trq_to_loc` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_trq_fy` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_trq_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_trq_loc` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `transfer_request_details` (
    `id`             INT PRIMARY KEY AUTO_INCREMENT,
    `request_id`     INT NOT NULL,
    `maker_id`       INT NOT NULL,
    `category_id`    INT NOT NULL,
    `power_id`       INT NULL,
    `stock_received` DECIMAL(15,2) DEFAULT 0.00,
    `stock_required` INT NOT NULL DEFAULT 0,
    `qty`            DECIMAL(15,2) DEFAULT 0.00,
    `qty_in_hand`    DECIMAL(15,2) DEFAULT 0.00,
    INDEX (`request_id`),
    INDEX (`maker_id`),
    INDEX (`category_id`),
    INDEX (`power_id`),
    CONSTRAINT `fk_trq_det_header` FOREIGN KEY (`request_id`) REFERENCES `transfer_requests` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_trq_det_maker` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`),
    CONSTRAINT `fk_trq_det_cat` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
    CONSTRAINT `fk_trq_det_power` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `transfers` (
    `id`                  INT PRIMARY KEY AUTO_INCREMENT,
    `trans_no`            VARCHAR(50) UNIQUE,
    `stock_req_no`        VARCHAR(255) NULL,
    `trans_date`          DATE NOT NULL,
    `from_location_id`    INT NULL,
    `to_location_id`      INT NULL,
    `total_amount`        DECIMAL(15,2) DEFAULT 0.00,
    `fiscal_year_id`      INT NOT NULL,
    `user_id`             INT NOT NULL,
    `location_id`         INT NOT NULL,
    `transfer_request_id` INT NULL,
    `created_at`          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `sequence_no`         INT DEFAULT 1,
    `transaction_type`    VARCHAR(20),
    `location_code`       VARCHAR(20),
    `fiscal_year_label`   VARCHAR(50),
    INDEX (`from_location_id`),
    INDEX (`to_location_id`),
    INDEX (`fiscal_year_id`),
    INDEX (`user_id`),
    INDEX (`location_id`),
    CONSTRAINT `fk_trn_req` FOREIGN KEY (`transfer_request_id`) REFERENCES `transfer_requests` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_trn_from_loc` FOREIGN KEY (`from_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_trn_to_loc` FOREIGN KEY (`to_location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_trn_fy` FOREIGN KEY (`fiscal_year_id`) REFERENCES `fiscal_years` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_trn_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_trn_loc` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `transfer_details` (
    `id`             INT PRIMARY KEY AUTO_INCREMENT,
    `transfer_id`    INT NOT NULL,
    `maker_id`       INT NOT NULL,
    `category_id`    INT NOT NULL,
    `power_id`       INT NULL,
    `stock_required` INT NOT NULL DEFAULT 0,
    `stock_req`      VARCHAR(255) NULL,
    `barcode`        VARCHAR(100) NULL,
    `lot_no`         VARCHAR(100) NULL,
    `sno`            VARCHAR(100) NULL,
    `serial_no`      VARCHAR(100) NULL,
    `exp_date`       DATE NULL,
    `mfg_date`       DATE NULL,
    `qty`            DECIMAL(15,2) DEFAULT 0.00,
    `qty_in_hand`    DECIMAL(15,2) DEFAULT 0.00,
    `rate`           DECIMAL(15,2) DEFAULT 0.00,
    `amount`         DECIMAL(15,2) DEFAULT 0.00,
    INDEX (`transfer_id`),
    INDEX (`maker_id`),
    INDEX (`category_id`),
    INDEX (`power_id`),
    INDEX (`barcode`),
    INDEX (`lot_no`),
    CONSTRAINT `fk_trn_det_header` FOREIGN KEY (`transfer_id`) REFERENCES `transfers` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_trn_det_maker` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`),
    CONSTRAINT `fk_trn_det_cat` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
    CONSTRAINT `fk_trn_det_power` FOREIGN KEY (`power_id`) REFERENCES `powers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- 15. Barcode Setup
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `barcode_format_setup` (
    `id`             INT PRIMARY KEY AUTO_INCREMENT,
    `format_type`    VARCHAR(100) NULL,
    `maker_id`       INT NULL,
    `sample_barcode` TEXT NULL,
    `lot_no`         VARCHAR(100) NULL,
    `sno`            VARCHAR(100) NULL,
    `exp_date`       DATE NULL,
    `mfg_years_less` INT DEFAULT 3,
    `is_active`      BOOLEAN DEFAULT TRUE,
    `created_at`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_bfs_maker` FOREIGN KEY (`maker_id`) REFERENCES `makers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;
