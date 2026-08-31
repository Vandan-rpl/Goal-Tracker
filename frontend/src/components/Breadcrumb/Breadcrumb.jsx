import React, { useMemo } from "react";
import {
  Breadcrumbs,
  Link,
  Typography,
  Box,
} from "@mui/material";

import NavigateNextIcon from "@mui/icons-material/NavigateNext";

import {
  Link as RouterLink,
  useLocation,
} from "react-router-dom";

import routeConfig from "../../routes/routeConfig";

const HOME_TITLE = "Dashboard";

const Breadcrumb = () => {
  const location = useLocation();

  const breadcrumbs = useMemo(() => {
    const pathname = location.pathname;

    // Dashboard
    if (
      pathname === "/" ||
      pathname === "/dashboard"
    ) {
      return [
        {
          title: HOME_TITLE,
          path: "/dashboard",
        },
      ];
    }

    const currentRoute = routeConfig.find(
      (route) => route.path === pathname
    );

    if (!currentRoute) {
      return [
        {
          title: HOME_TITLE,
          path: "/dashboard",
        },
      ];
    }

    const items = [
      {
        title: HOME_TITLE,
        path: "/dashboard",
      },
    ];

    /*
    |--------------------------------------------------------------------------
    | Parent Route Support
    |--------------------------------------------------------------------------
    | Optional:
    | route.parentId
    |--------------------------------------------------------------------------
    */

    if (currentRoute.parentId) {
      const parent = routeConfig.find(
        (route) =>
          route.id === currentRoute.parentId
      );

      if (parent) {
        items.push({
          title: parent.title,
          path: parent.path,
        });
      }
    }

    if (
      currentRoute.path !== "/dashboard"
    ) {
      items.push({
        title: currentRoute.title,
        path: currentRoute.path,
      });
    }

    return items;
  }, [location.pathname]);

  return (
    <Box
      sx={{
        mb: 1,
      }}
    >
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
      >
        {breadcrumbs.map(
          (crumb, index) => {
            const isLast =
              index ===
              breadcrumbs.length - 1;

            if (isLast) {
              return (
                <Typography
                  key={crumb.path}
                  color="text.primary"
                  fontWeight={600}
                >
                  {crumb.title}
                </Typography>
              );
            }

            return (
              <Link
                key={crumb.path}
                component={RouterLink}
                underline="hover"
                color="inherit"
                to={crumb.path}
              >
                {crumb.title}
              </Link>
            );
          }
        )}
      </Breadcrumbs>
    </Box>
  );
};

export default Breadcrumb;