import React from "react";
import PropTypes from "prop-types";

import {
  Box,
  Paper,
  Skeleton,
  Stack,
} from "@mui/material";

/**
 * ============================================================
 * Goal Tracker Management System
 * Table Loader
 * ============================================================
 */

const TableLoader = ({
  rows = 8,
  columns = 6,
  showHeader = true,
  showToolbar = true,
  paper = true,
}) => {
  const content = (
    <Stack spacing={2}>
      {/* Toolbar */}
      {showToolbar && (
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Skeleton
            variant="rounded"
            width={220}
            height={40}
          />

          <Skeleton
            variant="rounded"
            width={120}
            height={40}
          />
        </Stack>
      )}

      {/* Table */}
      <Box
        sx={{
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <thead>
            {showHeader && (
              <tr>
                {Array.from({
                  length: columns,
                }).map((_, index) => (
                  <th
                    key={`header-${index}`}
                    style={{
                      padding: 12,
                    }}
                  >
                    <Skeleton
                      variant="text"
                      width="80%"
                      height={28}
                    />
                  </th>
                ))}
              </tr>
            )}
          </thead>

          <tbody>
            {Array.from({
              length: rows,
            }).map((_, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {Array.from({
                  length: columns,
                }).map((_, columnIndex) => (
                  <td
                    key={`${rowIndex}-${columnIndex}`}
                    style={{
                      padding: 12,
                    }}
                  >
                    <Skeleton
                      variant="rounded"
                      width="100%"
                      height={24}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Stack>
  );

  if (!paper) {
    return content;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 2,
      }}
    >
      {content}
    </Paper>
  );
};

TableLoader.propTypes = {
  rows: PropTypes.number,
  columns: PropTypes.number,
  showHeader: PropTypes.bool,
  showToolbar: PropTypes.bool,
  paper: PropTypes.bool,
};

export default TableLoader;